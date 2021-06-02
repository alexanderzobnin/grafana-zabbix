import React, { FC } from 'react';
import { ActionButton } from '../ActionButton/ActionButton';

interface Props {
  className?: string;
  onClick(): void;
}

export const ExecScriptButton: FC<Props> = ({ className, onClick }) => {
  return (
    <ActionButton className={className} icon="terminal" tooltip="Execute script" onClick={onClick} />
  );
};
