import React, { FC } from 'react';
import { cx, css } from 'emotion';
import { Manager, Popper as ReactPopper, Reference } from 'react-popper';
import Transition from 'react-transition-group/Transition';
import { stylesFactory } from '@grafana/ui';
import BodyPortal from './Portal';

const getStyles = stylesFactory(() => ({
  defaultTransitionStyles: css`
    transition: opacity 200ms linear;
    opacity: 0;
  `,
  tooltipContent: css`
    overflow-wrap: break-word;
  `,
}));

const transitionStyles = {
  exited: { opacity: 0 },
  entering: { opacity: 0 },
  entered: { opacity: 1 },
  exiting: { opacity: 0 },
};

interface Props {
  renderContent: (content: any) => any;
  show: boolean;
  placement?: any;
  content: string | ((props: any) => JSX.Element);
  refClassName?: string;
  popperClassName?: string;
}

const Popper: FC<Props> = ({ show, placement, popperClassName, refClassName, content, children, renderContent }) => {
  const refClass = cx('popper_ref', refClassName);
  const styles = getStyles();
  const popperClass = cx('popper', popperClassName, styles.defaultTransitionStyles);

  return (
    <Manager>
      <Reference>
        {({ ref }) => (
          <div className={refClass} ref={ref}>
            {children}
          </div>
        )}
      </Reference>
      <Transition in={show} timeout={100} mountOnEnter={true} unmountOnExit={true}>
        {transitionState => (
          <BodyPortal>
            <ReactPopper placement={placement}>
              {({ ref, style, placement, arrowProps }) => {
                return (
                  <div
                    ref={ref}
                    style={{
                      ...style,
                      ...transitionStyles[transitionState],
                    }}
                    data-placement={placement}
                    className={popperClass}
                  >
                    <div className="popper__background">
                      <div className={styles.tooltipContent}>
                        {renderContent(content)}
                      </div>
                      <div ref={arrowProps.ref} data-placement={placement} className="popper__arrow" />
                    </div>
                  </div>
                );
              }}
            </ReactPopper>
          </BodyPortal>
        )}
      </Transition>
    </Manager>
  );
};

export default Popper;
