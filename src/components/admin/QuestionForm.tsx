"use client";

import { useMemo, useRef, useState } from "react";

type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TEXT" | "MATCHING";

export type QuestionFormValues = {
  questionId?: string;
  type: QuestionType;
  prompt: string;
  points: number;
  options: unknown;
  answerKey: unknown;
};

type QuestionFormProps = {
  action: (formData: FormData) => Promise<void>;
  disabled?: boolean;
  initialType?: QuestionType;
  initialValues?: QuestionFormValues;
  mode: "create" | "edit";
  testId?: string;
};

const typeLabels: Record<QuestionType, string> = {
  SINGLE_CHOICE: "Один вариант",
  MULTIPLE_CHOICE: "Несколько вариантов",
  TEXT: "Открытый ответ",
  MATCHING: "Сопоставление"
};

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function getCorrectIndex(value: unknown) {
  if (value && typeof value === "object" && "correctIndex" in value) {
    const index = Number((value as { correctIndex: unknown }).correctIndex);
    return Number.isInteger(index) ? index : 0;
  }

  return 0;
}

function getCorrectIndices(value: unknown) {
  if (value && typeof value === "object" && "correctIndices" in value) {
    const indices = (value as { correctIndices: unknown }).correctIndices;
    return Array.isArray(indices) ? indices.map(Number).filter(Number.isInteger) : [];
  }

  return [];
}

function getMatchingRows(options: unknown, answerKey: unknown) {
  if (!options || typeof options !== "object" || !("left" in options) || !("right" in options)) {
    return [
      { left: "", right: "" },
      { left: "", right: "" }
    ];
  }

  const left = asStringArray((options as { left: unknown }).left);
  const right = asStringArray((options as { right: unknown }).right);
  const pairs =
    answerKey && typeof answerKey === "object" && "pairs" in answerKey && typeof (answerKey as { pairs: unknown }).pairs === "object"
      ? ((answerKey as { pairs: Record<string, unknown> }).pairs ?? {})
      : {};

  if (left.length < 2 || right.length < 2) {
    return [
      { left: "", right: "" },
      { left: "", right: "" }
    ];
  }

  return left.map((leftItem, index) => {
    const rightIndex = Number(pairs[String(index)] ?? index);
    return {
      left: leftItem,
      right: right[rightIndex] ?? ""
    };
  });
}

function normalizeOptions(type: QuestionType, initialValues?: QuestionFormValues) {
  if (!initialValues) {
    return type === "MATCHING"
      ? [
          { left: "", right: "" },
          { left: "", right: "" }
        ]
      : ["", ""];
  }

  if (type === "MATCHING") {
    return getMatchingRows(initialValues.options, initialValues.answerKey);
  }

  const options = asStringArray(initialValues.options);
  return options.length >= 2 ? options : ["", ""];
}

export function QuestionForm({ action, disabled = false, initialType = "SINGLE_CHOICE", initialValues, mode, testId }: QuestionFormProps) {
  const [type, setType] = useState<QuestionType>(initialValues?.type ?? initialType);
  const [options, setOptions] = useState<string[]>(() => normalizeOptions(initialValues?.type ?? initialType, initialValues) as string[]);
  const [matchingRows, setMatchingRows] = useState<{ left: string; right: string }[]>(() =>
    normalizeOptions(initialValues?.type ?? initialType, initialValues) as { left: string; right: string }[]
  );
  const [correctIndex, setCorrectIndex] = useState(() => getCorrectIndex(initialValues?.answerKey));
  const [correctIndices, setCorrectIndices] = useState<number[]>(() => getCorrectIndices(initialValues?.answerKey));

  const submitLabel = mode === "create" ? "Добавить вопрос" : "Сохранить вопрос";
  const isChoice = type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE";
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    await action(formData);
    if (mode === "create") {
      formRef.current?.reset();
      setType(initialType);
      setOptions(["", ""]);
      setMatchingRows([
        { left: "", right: "" },
        { left: "", right: "" }
      ]);
      setCorrectIndex(0);
      setCorrectIndices([]);
    }
  }

  const matchingHiddenInputs = useMemo(
    () =>
      matchingRows.flatMap((row, index) => [
        <input key={`left-${index}`} name="leftItem" type="hidden" value={row.left} />,
        <input key={`right-${index}`} name="rightItem" type="hidden" value={row.right} />,
        <input key={`pair-${index}`} name="pair" type="hidden" value={`${index}:${index}`} />
      ]),
    [matchingRows]
  );

  function switchType(nextType: QuestionType) {
    setType(nextType);

    if (nextType === "MATCHING" && matchingRows.length < 2) {
      setMatchingRows([
        { left: "", right: "" },
        { left: "", right: "" }
      ]);
    }

    if ((nextType === "SINGLE_CHOICE" || nextType === "MULTIPLE_CHOICE") && options.length < 2) {
      setOptions(["", ""]);
    }
  }

  return (
    <form action={handleSubmit} className="admin-form" ref={formRef}>
      {testId ? <input name="testId" type="hidden" value={testId} /> : null}
      {initialValues?.questionId ? <input name="questionId" type="hidden" value={initialValues.questionId} /> : null}

      <div className="field">
        <label htmlFor={`${mode}-question-type`}>Тип вопроса</label>
        <select
          className="select"
          disabled={disabled}
          id={`${mode}-question-type`}
          name="type"
          onChange={(event) => switchType(event.target.value as QuestionType)}
          value={type}
        >
          {Object.entries(typeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor={`${mode}-question-prompt`}>Формулировка</label>
        <textarea className="textarea" defaultValue={initialValues?.prompt ?? ""} disabled={disabled} id={`${mode}-question-prompt`} name="prompt" required rows={4} />
      </div>

      <div className="field">
        <label htmlFor={`${mode}-question-points`}>Баллы</label>
        <input className="input" defaultValue={initialValues?.points ?? 1} disabled={disabled} id={`${mode}-question-points`} min={1} max={10} name="points" required type="number" />
      </div>

      {isChoice ? (
        <div className="field">
          <label>Варианты ответа</label>
          {options.map((option, index) => (
            <div className="option-edit-row" key={index}>
              {type === "SINGLE_CHOICE" ? (
                <input
                  checked={correctIndex === index}
                  disabled={disabled}
                  name="correctIndex"
                  onChange={() => setCorrectIndex(index)}
                  type="radio"
                  value={index}
                />
              ) : (
                <input
                  checked={correctIndices.includes(index)}
                  disabled={disabled}
                  name="correctIndices"
                  onChange={(event) =>
                    setCorrectIndices((current) =>
                      event.target.checked ? [...current, index] : current.filter((item) => item !== index)
                    )
                  }
                  type="checkbox"
                  value={index}
                />
              )}
              <input
                className="input"
                disabled={disabled}
                name="option"
                onChange={(event) => setOptions((current) => current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))}
                placeholder={`Вариант ${index + 1}`}
                required
                value={option}
              />
              <button
                className="btn btn-icon btn-ghost"
                disabled={disabled || options.length <= 2}
                onClick={() => {
                  setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index));
                  setCorrectIndices((current) => current.filter((item) => item !== index).map((item) => (item > index ? item - 1 : item)));
                  setCorrectIndex((current) => (current === index ? 0 : current > index ? current - 1 : current));
                }}
                type="button"
              >
                ×
              </button>
            </div>
          ))}
          {!disabled ? (
            <button className="btn btn-secondary" onClick={() => setOptions((current) => [...current, ""])} type="button">
              + Добавить вариант
            </button>
          ) : null}
        </div>
      ) : null}

      {type === "TEXT" ? <p className="text-muted">Открытые ответы проверяются администратором вручную.</p> : null}

      {type === "MATCHING" ? (
        <div className="field">
          <label>Пары для сопоставления</label>
          {matchingRows.map((row, index) => (
            <div className="matching-pair-row" key={index}>
              <input
                className="input"
                disabled={disabled}
                onChange={(event) =>
                  setMatchingRows((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, left: event.target.value } : item)))
                }
                placeholder={`Левая часть ${index + 1}`}
                required
                value={row.left}
              />
              <span>→</span>
              <input
                className="input"
                disabled={disabled}
                onChange={(event) =>
                  setMatchingRows((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, right: event.target.value } : item)))
                }
                placeholder={`Правая часть ${index + 1}`}
                required
                value={row.right}
              />
              <button
                className="btn btn-icon btn-ghost"
                disabled={disabled || matchingRows.length <= 2}
                onClick={() => setMatchingRows((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                type="button"
              >
                ×
              </button>
            </div>
          ))}
          {matchingHiddenInputs}
          {!disabled ? (
            <button className="btn btn-secondary" onClick={() => setMatchingRows((current) => [...current, { left: "", right: "" }])} type="button">
              + Добавить пару
            </button>
          ) : null}
          <p className="card-helper">В MVP каждая левая строка сопоставляется с правой строкой на той же позиции.</p>
        </div>
      ) : null}

      <button className="btn btn-accent" disabled={disabled} type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
