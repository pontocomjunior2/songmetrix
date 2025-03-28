import React from 'react';
import { MessageCircle, Mail } from 'lucide-react';

interface ContactProps {
  onClick?: () => void;
  className?: string;
}

function WhatsAppContact({ onClick, className = '' }: ContactProps) {
  const handleWhatsAppClick = () => {
    window.open('https://wa.me/5527998242137', '_blank');
  };

  const handleEmailClick = () => {
    window.open('mailto:contato@songmetrix.com.br', '_blank');
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <button 
        onClick={handleWhatsAppClick}
        className="flex items-center justify-center gap-2 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors w-full"
      >
        <MessageCircle className="w-4 h-4" />
        <span>WhatsApp</span>
      </button>
      
      <button 
        onClick={handleEmailClick}
        className="flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors w-full"
      >
        <Mail className="w-4 h-4" />
        <span>Email</span>
      </button>
    </div>
  );
}

export default WhatsAppContact; 