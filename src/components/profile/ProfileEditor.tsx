"use client";

import { Upload, Trash2 } from "lucide-react";
import { useRef } from "react";
import { useFormState } from "react-dom";
import { Avatar } from "@/components/ui/Avatar";
import {
  changePasswordAction,
  removeAvatarAction,
  uploadAvatarAction,
  updateProfileAction,
  type ProfileState
} from "@/lib/auth/profile";

type ProfileEditorProps = {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
  };
};

const initialState: ProfileState = {};

export function ProfileEditor({ user }: ProfileEditorProps) {
  const [profileState, profileFormAction] = useFormState(updateProfileAction, initialState);
  const [avatarState, avatarFormAction] = useFormState(uploadAvatarAction, initialState);
  const [removeState, removeFormAction] = useFormState(removeAvatarAction, initialState);
  const [passwordState, passwordFormAction] = useFormState(changePasswordAction, initialState);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarFormRef = useRef<HTMLFormElement>(null);

  function triggerFilePick() {
    fileInputRef.current?.click();
  }

  function onFileChosen() {
    avatarFormRef.current?.requestSubmit();
  }

  const lastAvatarMsg = avatarState.error || avatarState.success || removeState.error || removeState.success;

  return (
    <div className="stack profile-editor">
      <section className="card stack">
        <div className="row" style={{ gap: 24, flexWrap: "wrap" }}>
          <Avatar user={user} size={96} className="profile-avatar-preview" />
          <div className="stack" style={{ flex: 1, minWidth: 240, gap: 8 }}>
            <h3>Фотография профиля</h3>
            <p className="text-muted">JPG, PNG или WEBP. Не более 3 МБ.</p>
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              <form ref={avatarFormRef} action={avatarFormAction} encType="multipart/form-data">
                <input
                  ref={fileInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  name="avatar"
                  onChange={onFileChosen}
                  style={{ display: "none" }}
                  type="file"
                />
                <button className="btn btn-primary" onClick={triggerFilePick} type="button">
                  <Upload size={16} /> Загрузить
                </button>
              </form>
              {user.avatarUrl ? (
                <form action={removeFormAction}>
                  <button className="btn btn-ghost btn-danger" type="submit">
                    <Trash2 size={16} /> Удалить
                  </button>
                </form>
              ) : null}
            </div>
            {lastAvatarMsg ? (
              <p className={avatarState.error || removeState.error ? "text-danger" : "text-success"}>{lastAvatarMsg}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="card stack">
        <div>
          <h3>Основные данные</h3>
          <p className="text-muted">Email менять нельзя — он используется для входа</p>
        </div>
        <form action={profileFormAction} className="stack">
          <div className="row" style={{ gap: 16 }}>
            <div className="field field-half">
              <label htmlFor="firstName">Имя</label>
              <input className="input" defaultValue={user.firstName} id="firstName" name="firstName" required />
            </div>
            <div className="field field-half">
              <label htmlFor="lastName">Фамилия</label>
              <input className="input" defaultValue={user.lastName} id="lastName" name="lastName" required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input className="input" defaultValue={user.email} disabled id="email" type="email" />
          </div>
          {profileState.error ? <p className="text-danger">{profileState.error}</p> : null}
          {profileState.success ? <p className="text-success">{profileState.success}</p> : null}
          <button className="btn btn-primary btn-sm" style={{ alignSelf: "flex-end" }} type="submit">
            Сохранить
          </button>
        </form>
      </section>

      <section className="card stack">
        <div>
          <h3>Смена пароля</h3>
          <p className="text-muted">Минимум 8 символов</p>
        </div>
        <form action={passwordFormAction} className="stack">
          <div className="field">
            <label htmlFor="currentPassword">Текущий пароль</label>
            <input className="input" id="currentPassword" name="currentPassword" required type="password" />
          </div>
          <div className="row" style={{ gap: 16 }}>
            <div className="field field-half">
              <label htmlFor="newPassword">Новый пароль</label>
              <input className="input" id="newPassword" minLength={8} name="newPassword" required type="password" />
            </div>
            <div className="field field-half">
              <label htmlFor="confirmPassword">Повторите</label>
              <input className="input" id="confirmPassword" minLength={8} name="confirmPassword" required type="password" />
            </div>
          </div>
          {passwordState.error ? <p className="text-danger">{passwordState.error}</p> : null}
          {passwordState.success ? <p className="text-success">{passwordState.success}</p> : null}
          <button className="btn btn-primary btn-sm" style={{ alignSelf: "flex-end" }} type="submit">
            Обновить пароль
          </button>
        </form>
      </section>
    </div>
  );
}
