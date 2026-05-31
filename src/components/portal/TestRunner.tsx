"use client";

import { useState } from "react";
import { StaggerReveal } from "@/components/motion/StaggerReveal";
import { submitTestAttemptAction } from "@/lib/portal/actions";
import type { TakingQuestion } from "@/lib/portal/testing";

type TestRunnerProps = {
  testId: string;
  courseSlug: string;
  lessonId: string | null;
  questions: TakingQuestion[];
};

type SingleOptions = string[];
type MatchingOptions = { left: string[]; right: string[] };

export function TestRunner({ testId, courseSlug, lessonId, questions }: TestRunnerProps) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <form action={submitTestAttemptAction} className="stack" onSubmit={() => setSubmitting(true)}>
      <input type="hidden" name="testId" value={testId} />
      <input type="hidden" name="courseSlug" value={courseSlug} />
      {lessonId ? <input type="hidden" name="lessonId" value={lessonId} /> : null}

      <StaggerReveal className="stack">
        {questions.map((q, qIdx) => (
          <article key={q.id} className="card stack test-question motion-card" data-stagger-item>
            <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
              <div className="test-question-number">{qIdx + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3>{q.prompt}</h3>
                <p className="text-muted small">{q.points} {pluralPoints(q.points)} · {typeLabel(q.type)}</p>
              </div>
            </div>

            <QuestionInput question={q} />
          </article>
        ))}
      </StaggerReveal>

      <div className="card" style={{ position: "sticky", bottom: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <p className="text-muted">Перед отправкой убедитесь, что ответы заполнены. После отправки изменить нельзя.</p>
          <button className="btn btn-accent btn-lg" disabled={submitting} type="submit">
            {submitting ? "Отправка…" : "Отправить ответы"}
          </button>
        </div>
      </div>
    </form>
  );
}

function QuestionInput({ question }: { question: TakingQuestion }) {
  if (question.type === "SINGLE_CHOICE") {
    const options = (Array.isArray(question.options) ? question.options : []) as SingleOptions;
    return (
      <div className="stack" style={{ gap: 8 }}>
        {options.map((opt, idx) => (
          <label key={idx} className="test-option">
            <input name={`q-${question.id}`} required type="radio" value={idx} />
            <span>{opt}</span>
          </label>
        ))}
      </div>
    );
  }

  if (question.type === "MULTIPLE_CHOICE") {
    const options = (Array.isArray(question.options) ? question.options : []) as SingleOptions;
    return (
      <div className="stack" style={{ gap: 8 }}>
        {options.map((opt, idx) => (
          <label key={idx} className="test-option">
            <input name={`q-${question.id}`} type="checkbox" value={idx} />
            <span>{opt}</span>
          </label>
        ))}
        <p className="text-muted small">Можно выбрать несколько вариантов</p>
      </div>
    );
  }

  if (question.type === "TEXT") {
    return (
      <div className="field">
        <textarea
          className="textarea"
          name={`q-${question.id}`}
          placeholder="Введите ответ своими словами"
          required
          rows={5}
        />
        <span className="hint">Открытый ответ проверит администратор или РОП</span>
      </div>
    );
  }

  if (question.type === "MATCHING") {
    const opts = (question.options && typeof question.options === "object" ? question.options : {}) as Partial<MatchingOptions>;
    const left = Array.isArray(opts.left) ? opts.left : [];
    const right = Array.isArray(opts.right) ? opts.right : [];
    return (
      <div className="stack" style={{ gap: 10 }}>
        {left.map((leftItem, idx) => (
          <div key={idx} className="matching-input-row">
            <div className="matching-left">{leftItem}</div>
            <span className="matching-arrow">→</span>
            <select className="select" name={`q-${question.id}-${idx}`} required defaultValue="">
              <option value="" disabled>
                Выберите соответствие
              </option>
              {right.map((rightItem, rIdx) => (
                <option key={rIdx} value={rIdx}>
                  {rightItem}
                </option>
              ))}
            </select>
          </div>
        ))}
        <p className="text-muted small">Сопоставьте каждый левый пункт с правым</p>
      </div>
    );
  }

  return null;
}

function typeLabel(type: TakingQuestion["type"]) {
  switch (type) {
    case "SINGLE_CHOICE":
      return "один вариант";
    case "MULTIPLE_CHOICE":
      return "несколько вариантов";
    case "TEXT":
      return "открытый ответ";
    case "MATCHING":
      return "сопоставление";
  }
}

function pluralPoints(n: number) {
  const last = n % 10;
  const last2 = n % 100;
  if (last2 >= 11 && last2 <= 14) return "баллов";
  if (last === 1) return "балл";
  if (last >= 2 && last <= 4) return "балла";
  return "баллов";
}
