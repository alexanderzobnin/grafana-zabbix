import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { EventsWithValidation, ValidationEvents, useTheme } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { isRegex, variableRegex } from '../utils';

import * as grafanaUi from '@grafana/ui';
const Input = (grafanaUi as any).LegacyForms?.Input || (grafanaUi as any).Input;

const variablePattern = RegExp(`^${variableRegex.source}`);

const getStyles = (theme: GrafanaTheme) => ({
  inputRegex: css`
    color: ${theme.palette.orange}
  `,
  inputVariable: css`
    color: ${theme.colors.textBlue}
  `,
});

const zabbixInputValidationEvents: ValidationEvents = {
  [EventsWithValidation.onBlur]: [
    {
      rule: value => {
        if (!value) {
          return true;
        }
        if (value.length > 1 && value[0] === '/') {
          if (value[value.length - 1] !== '/') {
            return false;
          }
        }
        return true;
      },
      errorMessage: 'Not a valid regex',
    },
    {
      rule: value => {
        if (value === '*') {
          return false;
        }
        return true;
      },
      errorMessage: 'Wildcards not supported. Use /.*/ instead',
    },
  ],
};

export const ZabbixInput: FC<any> = ({ value, ref, validationEvents, ...restProps }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  let inputClass = styles.inputRegex;
  if (variablePattern.test(value as string)) {
    inputClass = styles.inputVariable;
  } else if (isRegex(value)) {
    inputClass = styles.inputRegex;
  }

  return (
    <Input
      className={inputClass}
      value={value}
      validationEvents={zabbixInputValidationEvents}
      {...restProps}
    />
  );
};
