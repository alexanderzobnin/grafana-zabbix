import React, { PureComponent } from 'react';
import { cx, css } from 'emotion';
import { ZBX_ACK_ACTION_ADD_MESSAGE, ZBX_ACK_ACTION_ACK, ZBX_ACK_ACTION_CHANGE_SEVERITY, ZBX_ACK_ACTION_CLOSE } from '../../datasource-zabbix/constants';
import { Button, VerticalGroup, Spinner, Modal, Input, Checkbox, RadioButtonGroup, stylesFactory, withTheme, Themeable, TextArea } from '@grafana/ui';
import { FAIcon } from '../../components';
import { GrafanaTheme } from '@grafana/data';

const KEYBOARD_ENTER_KEY = 13;
const KEYBOARD_ESCAPE_KEY = 27;

interface Props extends Themeable {
  canAck?: boolean;
  canClose?: boolean;
  severity?: number;
  withBackdrop?: boolean;
  onSubmit: (data?: AckProblemData) => Promise<any> | any;
  onDismiss?: () => void;
}

interface State {
  value: string;
  error: boolean;
  errorMessage: string;
  ackError: string;
  acknowledge: boolean;
  closeProblem: boolean;
  changeSeverity: boolean;
  selectedSeverity: number;
  loading: boolean;
}

export interface AckProblemData {
  message: string;
  closeProblem?: boolean;
  action?: number;
  severity?: number;
}

const severityOptions = [
  {value: 0, label: 'Not classified'},
  {value: 1, label: 'Information'},
  {value: 2, label: 'Warning'},
  {value: 3, label: 'Average'},
  {value: 4, label: 'High'},
  {value: 5, label: 'Disaster'}
];

export class AckModalUnthemed extends PureComponent<Props, State> {
  static defaultProps: Partial<Props> = {
    withBackdrop: true,
  };

  constructor(props) {
    super(props);
    this.state = {
      value: '',
      error: false,
      errorMessage: '',
      ackError: '',
      acknowledge: false,
      closeProblem: false,
      changeSeverity: false,
      selectedSeverity: props.severity || 0,
      loading: false,
    };
  }

  handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    this.setState({ value: event.target.value, error: false });
  }

  handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.which === KEYBOARD_ENTER_KEY || event.key === 'Enter') {
      // this.submit();
    } else if (event.which === KEYBOARD_ESCAPE_KEY || event.key === 'Escape') {
      this.dismiss();
    }
  }

  handleBackdropClick = () => {
    this.dismiss();
  }

  onAcknowledgeToggle = () => {
    this.setState({ acknowledge: !this.state.acknowledge, error: false });
  }

  onChangeSeverityToggle = () => {
    this.setState({ changeSeverity: !this.state.changeSeverity, error: false });
  }

  onCloseProblemToggle = () => {
    this.setState({ closeProblem: !this.state.closeProblem, error: false });
  }

  onChangeSelectedSeverity = v => {
    this.setState({ selectedSeverity: v });
  };

  dismiss = () => {
    this.setState({ value: '', error: false, errorMessage: '', ackError: '', loading: false });
    this.props.onDismiss();
  }

  submit = () => {
    const { acknowledge, changeSeverity, closeProblem } = this.state;

    const actionSelected = acknowledge || changeSeverity || closeProblem;
    if (!this.state.value && !actionSelected) {
      return this.setState({
        error: true,
        errorMessage: 'Enter message text or select an action'
      });
    }

    this.setState({ ackError: '', loading: true });

    const ackData: AckProblemData = {
      message: this.state.value,
    };

    let action = ZBX_ACK_ACTION_ADD_MESSAGE;
    if (this.state.acknowledge) {
      action += ZBX_ACK_ACTION_ACK;
    }
    if (this.state.changeSeverity) {
      action += ZBX_ACK_ACTION_CHANGE_SEVERITY;
      ackData.severity = this.state.selectedSeverity;
    }
    if (this.state.closeProblem) {
      action += ZBX_ACK_ACTION_CLOSE;
    }
    ackData.action = action;

    this.props.onSubmit(ackData).then(() => {
      this.dismiss();
    }).catch(err => {
      const errorMessage = err.data?.message || err.data?.error || err.data || err.statusText || '';
      this.setState({
        ackError: errorMessage,
        loading: false,
      });
    });
  }

  renderActions() {
    const { canClose } = this.props;

    const actions = [
      <Checkbox key="ack" label="Acknowledge" value={this.state.acknowledge} onChange={this.onAcknowledgeToggle} />,
      <Checkbox
        key="change-severity"
        label="Change severity"
        description=""
        value={this.state.changeSeverity}
        onChange={this.onChangeSeverityToggle}
      />,
      this.state.changeSeverity &&
        <RadioButtonGroup
          key="severity"
          size="sm"
          options={severityOptions}
          value={this.state.selectedSeverity}
          onChange={this.onChangeSelectedSeverity}
        />,
      canClose &&
        <Checkbox key="close" label="Close problem" disabled={!canClose} value={this.state.closeProblem} onChange={this.onCloseProblemToggle} />,
    ];

    // <VerticalGroup /> doesn't handle empty elements properly, so don't return it
    return actions.filter(e => e);
  }

  render() {
    const { theme } = this.props;

    const styles = getStyles(theme);
    const modalClass = cx(styles.modal);
    const modalTitleClass = cx(styles.modalHeaderTitle);
    const inputGroupClass = cx('gf-form', styles.inputGroup);
    const inputClass = cx(this.state.error && styles.input);
    const inputHintClass = cx('gf-form-hint-text', styles.inputHint);
    const inputErrorClass = cx('gf-form-hint-text', styles.inputError);

    return (
      <Modal
        isOpen={true}
        onDismiss={this.dismiss}
        className={modalClass}
        title={
          <div className={modalTitleClass}>
            {this.state.loading ? <Spinner size={18} /> : <FAIcon icon="reply-all" />}
            <span className="p-l-1">Acknowledge Problem</span>
          </div>
        }
      >
        <div className={inputGroupClass}>
          <label className="gf-form-hint">
            <TextArea className={inputClass}
              type="text"
              name="message"
              placeholder="Message"
              autoComplete="off"
              autoFocus={true}
              value={this.state.value}
              onChange={this.handleChange}
              onKeyDown={this.handleKeyPress}>
            </TextArea>
            <small className={inputHintClass}>Press Enter to submit</small>
            {this.state.error &&
              <small className={inputErrorClass}>{this.state.errorMessage}</small>
            }
          </label>
        </div>

        <div className="gf-form">
          <VerticalGroup>
            {this.renderActions()}
          </VerticalGroup>
        </div>

        {this.state.ackError &&
          <div className="gf-form ack-request-error">
            <span className={styles.ackError}>{this.state.ackError}</span>
          </div>
        }

        <div className="gf-form-button-row text-center">
          <Button variant="primary" onClick={this.submit}>Update</Button>
          <Button variant="secondary" onClick={this.dismiss}>Cancel</Button>
        </div>
      </Modal>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const red = theme.palette.red;
  return {
    modal: css`
      width: 500px;
    `,
    modalHeaderTitle: css`
      font-size: ${theme.typography.heading.h3};
      padding-top: ${theme.spacing.sm};
      margin: 0 ${theme.spacing.md};
      display: flex;
    `,
    inputGroup: css`
      margin-bottom: 16px;
    `,
    input: css`
      border-color: ${red};
      border-radius: 2px;
      outline-offset: 2px;
      box-shadow: 0 0 0 2px ${theme.colors.bg1}, 0 0 0px 4px ${red};
    `,
    inputHint: css`
      display: inherit;
      float: right;
      color: ${theme.colors.textWeak};
    `,
    inputError: css`
      float: left;
      color: ${red};
    `,
    ackError: css`
      color: ${red};
    `,
  };
});

export const AckModal = withTheme(AckModalUnthemed);
