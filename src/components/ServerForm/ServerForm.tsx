import React, { useState, useEffect } from 'react';
import { ServerProfile } from '../../types';

interface ServerFormProps {
  profile?: ServerProfile;
  onClose: () => void;
  onSave: () => void;
}

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
    if (profile) {
      setFormData({
        name: profile.name,
        host: profile.host,
        port: profile.port,
        username: profile.username,
        authType: profile.authType,
        credential: '', // No mostrar credenciales existentes por seguridad
      });
    }
  }, [profile]);

  const handleSelectKeyfile = async () => {
    try {
      const result = await window.api.dialog.selectKeyfile();
      if (result.success && result.content) {
        setFormData((prev) => ({ ...prev, credential: result.content }));
        setKeyfilePath(result.path || '');
      }
    } catch (err) {
      setError('Error al seleccionar archivo de clave');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (!formData.name || !formData.host || !formData.username) {
        throw new Error('Nombre, host y usuario son requeridos');
      }

      if (!profile && !formData.credential) {
        throw new Error('La contraseña o clave es requerida');
      }

      if (profile) {
        // Actualizar
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
        // Crear nuevo
        await window.api.profiles.create(formData);
      }

      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-ssh-dark border border-gray-700 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">
          {profile ? 'Editar Servidor' : 'Nuevo Servidor'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nombre</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Producción Tomcat1"
              className="w-full bg-ssh-darker border border-gray-600 rounded px-3 py-2 text-white focus:border-ssh-accent focus:outline-none"
            />
          </div>

          {/* Host */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Host</label>
              <input
                type="text"
                value={formData.host}
                onChange={(e) => setFormData((prev) => ({ ...prev, host: e.target.value }))}
                placeholder="10.112.0.61"
                className="w-full bg-ssh-darker border border-gray-600 rounded px-3 py-2 text-white focus:border-ssh-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Puerto</label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) => setFormData((prev) => ({ ...prev, port: parseInt(e.target.value) || 22 }))}
                className="w-full bg-ssh-darker border border-gray-600 rounded px-3 py-2 text-white focus:border-ssh-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Usuario */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Usuario</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
              placeholder="consulta"
              className="w-full bg-ssh-darker border border-gray-600 rounded px-3 py-2 text-white focus:border-ssh-accent focus:outline-none"
            />
          </div>

          {/* Tipo de autenticación */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Autenticación</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="authType"
                  checked={formData.authType === 'password'}
                  onChange={() => setFormData((prev) => ({ ...prev, authType: 'password', credential: '' }))}
                  className="text-ssh-accent"
                />
                <span>Contraseña</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="authType"
                  checked={formData.authType === 'keyfile'}
                  onChange={() => setFormData((prev) => ({ ...prev, authType: 'keyfile', credential: '' }))}
                  className="text-ssh-accent"
                />
                <span>Clave privada</span>
              </label>
            </div>
          </div>

          {/* Credencial */}
          {formData.authType === 'password' ? (
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Contraseña {profile && '(dejar vacío para mantener)'}
              </label>
              <input
                type="password"
                value={formData.credential}
                onChange={(e) => setFormData((prev) => ({ ...prev, credential: e.target.value }))}
                className="w-full bg-ssh-darker border border-gray-600 rounded px-3 py-2 text-white focus:border-ssh-accent focus:outline-none"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Archivo de clave</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={keyfilePath}
                  readOnly
                  placeholder="Seleccionar archivo .pem/.ppk"
                  className="flex-1 bg-ssh-darker border border-gray-600 rounded px-3 py-2 text-gray-400 cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={handleSelectKeyfile}
                  className="px-4 py-2 bg-ssh-light border border-gray-600 rounded hover:bg-gray-600 transition-colors"
                >
                  Buscar
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-ssh-error text-sm bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
              {error}
            </div>
          )}

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-ssh-accent text-ssh-darker font-medium rounded hover:bg-blue-400 transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
