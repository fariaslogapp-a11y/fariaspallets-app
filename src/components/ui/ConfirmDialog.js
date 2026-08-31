'use client';

import Modal from './Modal';
import { AlertTriangle, Trash2 } from 'lucide-react';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmar Exclusão',
  message = 'Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.',
  confirmText = 'Excluir',
  cancelText = 'Cancelar',
  variant = 'danger',
  loading = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="confirm-icon danger">
        {variant === 'danger' ? <Trash2 size={28} /> : <AlertTriangle size={28} />}
      </div>
      <div className="confirm-text">
        <h3>{title}</h3>
        <p>{message}</p>
      </div>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
          {cancelText}
        </button>
        <button
          className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? 'Aguarde...' : confirmText}
        </button>
      </div>
    </Modal>
  );
}
