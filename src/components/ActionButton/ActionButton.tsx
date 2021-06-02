import React, { FC } from 'react';
import { cx, css } from 'emotion';
import { stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme, GrafanaThemeType } from '@grafana/data';
import { FAIcon } from '../FAIcon/FAIcon';
import { Tooltip } from '../Tooltip/Tooltip';

interface Props {
  icon?: string;
  width?: number;
  tooltip?: string;
  className?: string;
  onClick(event: React.MouseEvent<HTMLButtonElement>): void;
}

export const ActionButton: FC<Props> = ({ icon, width, tooltip, className, children, onClick }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const buttonClass = cx(
    'btn',
    styles.button,
    css`width: ${width || 3}rem`,
    className,
  );

  let button = (
    <button className={buttonClass} onClick={onClick}>
      {icon && <FAIcon icon={icon} customClass={styles.icon} />}
      {children}
    </button>
  );

  if (tooltip) {
    button = (
      <Tooltip placement="bottom" content={tooltip}>
        {button}
      </Tooltip>
    );
  }

  return button;
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const actionBlue = theme.type === GrafanaThemeType.Light ? '#497dc0' : '#005f81';
  const hoverBlue = theme.type === GrafanaThemeType.Light ? '#456ba4' : '#354f77';

  return {
    button: css`
      height: 2rem;
      background-image: none;
      background-color: ${actionBlue};
      border: 1px solid ${theme.palette.gray1};
      border-radius: 1px;
      color: ${theme.colors.text};

      i {
        vertical-align: middle;
      }

      &:hover {
        background-color: ${hoverBlue};
      }
    `,
    icon: css`
      i {
        color: ${theme.colors.text};
      }
    `,
  };
});
