import React, { useEffect, useState } from 'react';
import { ServerProfile } from '../../types';
import { Modal } from '../ui/Modal';

interface ServerFormProps {
  profile?: ServerProfile;
  onClose: () => void;
  onSave: () => void | Promise<void>;
}

const KeyIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a4 4 0 11-7.446 2H3v4h4v4h5.554A4 4 0 1115 7z" />
  </svg>
);

const PasswordIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z" />
  </svg>
);

const FolderIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

export const ServerForm: React.FC<ServerFormProps> = ({ profile, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: 22,
    username: '',
    authType: 'password' as 'password' | 'keyfile',
    credential: '',
  });
  const [keyfilePath, setKeyfilePath] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) {
      return;
    }

    setFormData({
      name: profile.name,
      host: profile.host,
      port: profile.port,
      username: profile.username,
      authType: profile.authType,
      credential: '',
    });
    setKeyfilePath('');
  }, [profile]);

  const handleSelectKeyfile = async () => {
    try {
      const result = await window.api.dialog.selectKeyfile();
      if (result.success && result.content) {
        setFormData((previous) => ({ ...previous, credential: result.content || '' }));
        setKeyfilePath(result.path || '');
      }
    } catch {
      setError('No se pudo cargar el archivo de clave.');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      const authTypeChanged = Boolean(profile && formData.authType !== profile.authType);

      if (!formData.name || !formData.host || !formData.username) {
        throw new Error('Nombre, host y usuario son requeridos.');
      }

      if (!profile && !formData.credential) {
        throw new Error('Debes indicar una credencial para crear el perfil.');
      }

      if (authTypeChanged && !formData.credential) {
        throw new Error('Debes indicar una credencial nueva al cambiar el tipo de autenticacion.');
      }

      if (profile) {
        const updateData: Partial<ServerProfile> = {
          name: formData.name,
          host: formData.host,
          port: formData.port,
          username: formData.username,
          authType: formData.authType,
        };

        if (formData.credential) {
          updateData.credential = formData.credential;
        }

        await window.api.profiles.update(profile.id, updateData);
      } else {
        await window.api.profiles.create(formData);
      }

      await onSave();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  const isPassword = formData.authType === 'password';
  const authTypeChanged = Boolean(profile && formData.authType !== profile.authType);

  return (
    <Modal
      title={profile ? 'Editar servidor' : 'Nuevo servidor'}
      description="Configura acceso SSH, autenticacion y datos base del perfil. Las credenciales se mantienen locales."
      onClose={onClose}
      widthClassName="max-w-4xl"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="server-form" disabled={saving} className="btn-primary">
            {saving ? 'Guardando...' : profile ? 'Guardar cambios' : 'Crear servidor'}
          </button>
        </>
      }
    >
      <form id="server-form" onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.95fr)]">
          <div className="space-y-5">
            <div>
              <div className="section-label">Identidad</div>
              <div className="mt-3 grid gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Nombre visible</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(event) => setFormData((previous) => ({ ...previous, name: event.target.value }))}
                    placeholder="Produccion Tomcat"
                    className="input"
                  />
                  <p className="mt-2 body-xs">Este nombre se muestra en la barra lateral y las pestañas.</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Host o IP</label>
                    <input
                      type="text"
                      value={formData.host}
                      onChange={(event) => setFormData((previous) => ({ ...previous, host: event.target.value }))}
                      placeholder="10.112.0.61"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Puerto</label>
                    <input
                      type="number"
                      value={formData.port}
                      onChange={(event) =>
                        setFormData((previous) => ({ ...previous, port: Number.parseInt(event.target.value, 10) || 22 }))
                      }
                      className="input"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Usuario SSH</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(event) => setFormData((previous) => ({ ...previous, username: event.target.value }))}
                    placeholder="consulta"
                    className="input"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="panel-surface px-4 py-4">
            <div className="section-label">Autenticacion</div>
            <div className="mt-3 segmented w-full">
              <button
                type="button"
                className="segmented-item flex flex-1 items-center justify-center gap-2"
                data-active={isPassword}
                onClick={() => setFormData((previous) => ({ ...previous, authType: 'password', credential: '' }))}
              >
                <PasswordIcon />
                Contraseña
              </button>
              <button
                type="button"
                className="segmented-item flex flex-1 items-center justify-center gap-2"
                data-active={!isPassword}
                onClick={() => setFormData((previous) => ({ ...previous, authType: 'keyfile', credential: '' }))}
              >
                <KeyIcon />
                Clave privada
              </button>
            </div>

            <div className="mt-4 body-xs">
              {isPassword
                ? 'Usa credenciales directas para servidores internos o accesos temporales.'
                : 'Carga un archivo PEM o PPK para perfiles persistentes y accesos endurecidos.'}
            </div>

            {isPassword ? (
              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
                  Contraseña {profile && !authTypeChanged ? '(dejar vacio para mantener)' : ''}
                </label>
                <input
                  type="password"
                  value={formData.credential}
                  onChange={(event) => setFormData((previous) => ({ ...previous, credential: event.target.value }))}
                  className="input"
                />
              </div>
            ) : (
              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Archivo de clave</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={keyfilePath || (profile?.authType === 'keyfile' ? 'Clave privada almacenada' : '')}
                    readOnly
                    placeholder="Seleccionar archivo .pem o .ppk"
                    className="input flex-1 cursor-default text-[var(--text-secondary)]"
                  />
                  <button type="button" onClick={handleSelectKeyfile} className="btn-secondary shrink-0">
                    <FolderIcon />
                    Buscar
                  </button>
                </div>
                {authTypeChanged ? (
                  <p className="mt-2 body-xs">Debes cargar una clave nueva para cambiar este perfil a autenticacion por archivo.</p>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {error ? <div className="notice-danger">{error}</div> : null}
      </form>
    </Modal>
  );
};
