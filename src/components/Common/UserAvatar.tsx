import React from 'react';

interface UserAvatarProps {
  email: string;
  photoURL?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ 
  email, 
  photoURL, 
  size = 'md',
  className = '' 
}) => {
  // Get the first letter of the email
  const firstLetter = email.charAt(0).toUpperCase();
  
  // Generate a consistent color based on the email
  const getColorFromEmail = (email: string) => {
    const colors = [
      'bg-blue-500',
      'bg-purple-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-indigo-500',
      'bg-pink-500',
      'bg-teal-500'
    ];
    
    // Simple hash function
    const hash = email.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    return colors[Math.abs(hash) % colors.length];
  };

  // Size classes
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg'
  };

  // If there's a photoURL and it's from Google (contains googleusercontent.com)
  if (photoURL?.includes('googleusercontent.com')) {
    return (
      <img
        src={photoURL}
        alt={email}
        className={`rounded-full ${sizeClasses[size]} ${className} object-cover`}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className={`
      ${sizeClasses[size]}
      ${getColorFromEmail(email)}
      rounded-full
      flex
      items-center
      justify-center
      text-white
      font-semibold
      ${className}
    `}>
      {firstLetter}
    </div>
  );
};

export default UserAvatar;
