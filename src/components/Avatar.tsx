import { useState } from 'react';

interface AvatarProps {
  name: string;
  photoURL?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  ringColor?: string;
}

const SIZE_MAP = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-6 h-6 text-[11px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-9 h-9 text-sm',
};

const BG_PALETTE = [
  'bg-[#7A2346] text-[#FFF5F6]',
  'bg-[#8F3157] text-[#FFF5F6]',
  'bg-[#5B1733] text-[#FFF5F6]',
  'bg-[#C86B88] text-[#FFF5F6]',
  'bg-[#527FC4] text-[#FFF5F6]',
  'bg-[#21865B] text-[#FFF5F6]',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getBgClass(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return BG_PALETTE[hash % BG_PALETTE.length];
}

export function Avatar({ name, photoURL, size = 'sm', ringColor }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const sizeClass = SIZE_MAP[size];
  const showImage = Boolean(photoURL && !imgError);

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none overflow-hidden ring-1 ring-[#EAD7DE] dark:ring-[#E9A8B8]/25 ${sizeClass} ${
        showImage ? 'bg-[#FCE8EC] dark:bg-[#5B1733]' : getBgClass(name || 'User')
      }`}
      style={ringColor ? { boxShadow: `0 0 0 2px ${ringColor}` } : undefined}
      title={name}
    >
      {showImage ? (
        <img
          src={photoURL}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{getInitials(name || 'U')}</span>
      )}
    </span>
  );
}
