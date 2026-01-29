'use client';

import { useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ActiveUser } from '@/types';

interface CollaboratorAvatarsProps {
  users: ActiveUser[];
  maxVisible?: number;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
};

const offsetClasses = {
  sm: '-ml-2',
  md: '-ml-2.5',
  lg: '-ml-3',
};

export function CollaboratorAvatars({
  users,
  maxVisible = 5,
  size = 'md',
}: CollaboratorAvatarsProps) {
  const visibleUsers = users.slice(0, maxVisible);
  const remainingCount = users.length - maxVisible;

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      const parts = name.split(' ');
      return parts.length > 1
        ? `${parts[0][0]}${parts[1][0]}`
        : name.slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <TooltipProvider>
      <div className="flex items-center">
        {visibleUsers.map((user, index) => (
          <Tooltip key={user.id}>
            <TooltipTrigger asChild>
              <div
                className={`
                  ${sizeClasses[size]}
                  ${index > 0 ? offsetClasses[size] : ''}
                  rounded-full border-2 border-background flex items-center justify-center
                  font-medium uppercase cursor-pointer transition-transform hover:scale-110 hover:z-10
                `}
                style={{ backgroundColor: user.color }}
              >
                {user.image ? (
                  <img
                    src={user.image}
                    alt={user.name || user.email}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-white">
                    {getInitials(user.name, user.email)}
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{user.name || user.email}</p>
              {user.name && <p className="text-xs text-muted-foreground">{user.email}</p>}
            </TooltipContent>
          </Tooltip>
        ))}

        {remainingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`
                  ${sizeClasses[size]}
                  ${offsetClasses[size]}
                  rounded-full border-2 border-background bg-muted flex items-center justify-center
                  font-medium cursor-pointer
                `}
              >
                +{remainingCount}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                {users.slice(maxVisible).map((user) => (
                  <p key={user.id} className="text-sm">
                    {user.name || user.email}
                  </p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
