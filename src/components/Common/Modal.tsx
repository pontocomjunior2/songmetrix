import React, { useState } from 'react';

interface ModalProps {
  onClose: () => void;
  onConfirm: (selectedRadios: string[]) => void;
  availableRadios: string[];
}

const Modal: React.FC<ModalProps> = ({ onClose, onConfirm, availableRadios }) => {
  const [selectedRadios, setSelectedRadios] = useState<string[]>([]);

  const toggleRadio = (radio: string) => {
    setSelectedRadios(prev => 
      prev.includes(radio) ? prev.filter(r => r !== radio) : [...prev, radio]
    );
  };

  return (
    <div className="modal">
      <h2>Selecione suas rádios favoritas</h2>
      <div>
        {availableRadios.map(radio => (
          <div key={radio}>
            <input 
              type="checkbox" 
              checked={selectedRadios.includes(radio)} 
              onChange={() => toggleRadio(radio)} 
            />
            {radio}
          </div>
        ))}
      </div>
      <button onClick={() => onConfirm(selectedRadios)}>Confirmar</button>
      <button onClick={onClose}>Fechar</button>
    </div>
  );
};

export default Modal;
