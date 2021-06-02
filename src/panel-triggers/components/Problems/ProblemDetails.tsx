import React, { FC, PureComponent } from 'react';
import moment from 'moment';
import * as utils from '../../../datasource-zabbix/utils';
import { ProblemDTO, ZBXHost, ZBXGroup, ZBXEvent, ZBXTag, ZBXAlert } from '../../../datasource-zabbix/types';
import { ZBXScript, APIExecuteScriptResponse } from '../../../datasource-zabbix/zabbix/connectors/zabbix_api/types';
import { ZBXItem, GFTimeRange, RTRow } from '../../types';
import { AckModal, AckProblemData } from '../AckModal';
import EventTag from '../EventTag';
import ProblemStatusBar from './ProblemStatusBar';
import AcknowledgesList from './AcknowledgesList';
import ProblemTimeline from './ProblemTimeline';
import { FAIcon, ExploreButton, AckButton, Tooltip, ModalController, ExecScriptButton } from '../../../components';
import { ExecScriptModal, ExecScriptData } from '../ExecScriptModal';
import { Icon } from '@grafana/ui';

interface ProblemDetailsProps extends RTRow<ProblemDTO> {
  rootWidth: number;
  timeRange: GFTimeRange;
  showTimeline?: boolean;
  panelId?: number;
  getProblemEvents: (problem: ProblemDTO) => Promise<ZBXEvent[]>;
  getProblemAlerts: (problem: ProblemDTO) => Promise<ZBXAlert[]>;
  getScripts: (problem: ProblemDTO) => Promise<ZBXScript[]>;
  onExecuteScript(problem: ProblemDTO, scriptid: string): Promise<APIExecuteScriptResponse>;
  onProblemAck?: (problem: ProblemDTO, data: AckProblemData) => Promise<any> | any;
  onTagClick?: (tag: ZBXTag, datasource: string, ctrlKey?: boolean, shiftKey?: boolean) => void;
}

interface ProblemDetailsState {
  events: ZBXEvent[];
  alerts: ZBXAlert[];
  show: boolean;
}

export class ProblemDetails extends PureComponent<ProblemDetailsProps, ProblemDetailsState> {
  constructor(props) {
    super(props);
    this.state = {
      events: [],
      alerts: [],
      show: false,
    };
  }

  componentDidMount() {
    if (this.props.showTimeline) {
      this.fetchProblemEvents();
    }
    this.fetchProblemAlerts();
    requestAnimationFrame(() => {
      this.setState({ show: true });
    });
  }

  handleTagClick = (tag: ZBXTag, ctrlKey?: boolean, shiftKey?: boolean) => {
    if (this.props.onTagClick) {
      this.props.onTagClick(tag, this.props.original.datasource, ctrlKey, shiftKey);
    }
  }

  fetchProblemEvents() {
    const problem = this.props.original;
    this.props.getProblemEvents(problem)
    .then(events => {
      this.setState({ events });
    });
  }

  fetchProblemAlerts() {
    const problem = this.props.original;
    this.props.getProblemAlerts(problem)
    .then(alerts => {
      this.setState({ alerts });
    });
  }

  ackProblem = (data: AckProblemData) => {
    const problem = this.props.original as ProblemDTO;
    return this.props.onProblemAck(problem, data);
  }

  getScripts = () => {
    const problem = this.props.original as ProblemDTO;
    return this.props.getScripts(problem);
  }

  onExecuteScript = (data: ExecScriptData) => {
    const problem = this.props.original as ProblemDTO;
    return this.props.onExecuteScript(problem, data.scriptid);
  }

  render() {
    const problem = this.props.original as ProblemDTO;
    const alerts = this.state.alerts;
    const rootWidth = this.props.rootWidth;
    const displayClass = this.state.show ? 'show' : '';
    const wideLayout = rootWidth > 1200;
    const compactStatusBar = rootWidth < 800 || problem.acknowledges && wideLayout && rootWidth < 1400;
    const age = moment.unix(problem.timestamp).fromNow(true);
    const showAcknowledges = problem.acknowledges && problem.acknowledges.length !== 0;
    const problemSeverity = Number(problem.severity);

    return (
      <div className={`problem-details-container ${displayClass}`}>
        <div className="problem-details">
          <div className="problem-details-row">
            <div className="problem-value-container">
              <div className="problem-age">
                <FAIcon icon="clock-o" />
                <span>{age}</span>
              </div>
              {problem.items && <ProblemItems items={problem.items} />}
            </div>
            <div className="problem-actions-left">
              <ExploreButton problem={problem} panelId={this.props.panelId} />
            </div>
            <ProblemStatusBar problem={problem} alerts={alerts} className={compactStatusBar && 'compact'} />
            {problem.showAckButton &&
              <div className="problem-actions">
                <ModalController>
                  {({ showModal, hideModal }) => (
                    <ExecScriptButton
                      className="navbar-button navbar-button--settings"
                      onClick={() => {
                        showModal(ExecScriptModal, {
                          getScripts: this.getScripts,
                          onSubmit: this.onExecuteScript,
                          onDismiss: hideModal,
                        });
                      }}
                    />
                  )}
                </ModalController>
                <ModalController>
                  {({ showModal, hideModal }) => (
                    <AckButton
                      className="navbar-button navbar-button--settings"
                      onClick={() => {
                        showModal(AckModal, {
                          canClose: problem.manual_close === '1',
                          severity: problemSeverity,
                          onSubmit: this.ackProblem,
                          onDismiss: hideModal,
                        });
                      }}
                    />
                  )}
                </ModalController>
              </div>
            }
          </div>
          {problem.comments &&
            <div className="problem-description-row">
              <div className="problem-description">
                <Tooltip placement="right" content={problem.comments}>
                  <span className="description-label">Description:&nbsp;</span>
                </Tooltip>
                <span>{problem.comments}</span>
              </div>
            </div>
          }
          {problem.tags && problem.tags.length > 0 &&
            <div className="problem-tags">
              {problem.tags && problem.tags.map(tag =>
                <EventTag
                  key={tag.tag + tag.value}
                  tag={tag}
                  highlight={tag.tag === problem.correlation_tag}
                  onClick={this.handleTagClick}
                />)
              }
            </div>
          }
          {this.props.showTimeline && this.state.events.length > 0 &&
            <ProblemTimeline events={this.state.events} timeRange={this.props.timeRange} />
          }
          {showAcknowledges && !wideLayout &&
            <div className="problem-ack-container">
              <h6><FAIcon icon="reply-all" /> Acknowledges</h6>
              <AcknowledgesList acknowledges={problem.acknowledges} />
            </div>
          }
        </div>
        {showAcknowledges && wideLayout &&
          <div className="problem-details-middle">
            <div className="problem-ack-container">
              <h6><FAIcon icon="reply-all" /> Acknowledges</h6>
              <AcknowledgesList acknowledges={problem.acknowledges} />
            </div>
          </div>
        }
        <div className="problem-details-right">
          <div className="problem-details-right-item">
            <FAIcon icon="database" />
            <span>{problem.datasource}</span>
          </div>
          {problem.proxy &&
            <div className="problem-details-right-item">
              <FAIcon icon="cloud" />
              <span>{problem.proxy}</span>
            </div>
          }
          {problem.groups && <ProblemGroups groups={problem.groups} className="problem-details-right-item" />}
          {problem.hosts && <ProblemHosts hosts={problem.hosts} className="problem-details-right-item" />}
        </div>
      </div>
    );
  }
}

interface ProblemItemProps {
  item: ZBXItem;
  showName?: boolean;
}

function ProblemItem(props: ProblemItemProps) {
  const { item, showName } = props;
  const itemName = utils.expandItemName(item.name, item.key_);
  const tooltipContent = () => <>{itemName}<br/>{item.lastvalue}</>;

  return (
    <div className="problem-item">
      <FAIcon icon="thermometer-three-quarters" />
      {showName && <span className="problem-item-name">{item.name}: </span>}
      <Tooltip placement="top-start" content={tooltipContent}>
        <span className="problem-item-value">{item.lastvalue}</span>
      </Tooltip>
    </div>
  );
}

interface ProblemItemsProps {
  items: ZBXItem[];
}

const ProblemItems: FC<ProblemItemsProps> = ({ items }) => {
  return (
    <div className="problem-items-row">
      {items.length > 1 ?
        items.map(item => <ProblemItem item={item} key={item.itemid} showName={true} />) :
        <ProblemItem item={items[0]} />
      }
    </div>
  );
};

interface ProblemGroupsProps {
  groups: ZBXGroup[];
  className?: string;
}

class ProblemGroups extends PureComponent<ProblemGroupsProps> {
  render() {
    return this.props.groups.map(g => (
      <div className={this.props.className || ''} key={g.groupid}>
        <FAIcon icon="folder" />
        <span>{g.name}</span>
      </div>
    ));
  }
}

interface ProblemHostsProps {
  hosts: ZBXHost[];
  className?: string;
}

class ProblemHosts extends PureComponent<ProblemHostsProps> {
  render() {
    return this.props.hosts.map(h => (
      <div className={this.props.className || ''} key={h.hostid}>
        <FAIcon icon="server" />
        <span>{h.name}</span>
      </div>
    ));
  }
}
