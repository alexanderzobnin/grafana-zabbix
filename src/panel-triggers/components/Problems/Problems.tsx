import React, { PureComponent } from 'react';
import ReactTable from 'react-table-6';
import classNames from 'classnames';
import _ from 'lodash';
import moment from 'moment';
import { isNewProblem } from '../../utils';
import EventTag from '../EventTag';
import { ProblemDetails } from './ProblemDetails';
import { AckProblemData } from '../AckModal';
import { GFHeartIcon, FAIcon } from '../../../components';
import { ProblemsPanelOptions, GFTimeRange, RTCell, TriggerSeverity, RTResized } from '../../types';
import { ProblemDTO, ZBXEvent, ZBXTag, ZBXAlert } from '../../../datasource-zabbix/types';
import { ZBXScript, APIExecuteScriptResponse } from '../../../datasource-zabbix/zabbix/connectors/zabbix_api/types';
import { AckCell } from './AckCell';

export interface ProblemListProps {
  problems: ProblemDTO[];
  panelOptions: ProblemsPanelOptions;
  loading?: boolean;
  timeRange?: GFTimeRange;
  pageSize?: number;
  fontSize?: number;
  panelId?: number;
  getProblemEvents: (problem: ProblemDTO) => Promise<ZBXEvent[]>;
  getProblemAlerts: (problem: ProblemDTO) => Promise<ZBXAlert[]>;
  getScripts: (problem: ProblemDTO) => Promise<ZBXScript[]>;
  onExecuteScript: (problem: ProblemDTO, scriptid: string) => Promise<APIExecuteScriptResponse>;
  onProblemAck?: (problem: ProblemDTO, data: AckProblemData) => void;
  onTagClick?: (tag: ZBXTag, datasource: string, ctrlKey?: boolean, shiftKey?: boolean) => void;
  onPageSizeChange?: (pageSize: number, pageIndex: number) => void;
  onColumnResize?: (newResized: RTResized) => void;
}

interface ProblemListState {
  expanded: any;
  expandedProblems: any;
  page: number;
}

export default class ProblemList extends PureComponent<ProblemListProps, ProblemListState> {
  rootWidth: number;
  rootRef: any;

  constructor(props) {
    super(props);
    this.state = {
      expanded: {},
      expandedProblems: {},
      page: 0,
    };
  }

  setRootRef = ref => {
    this.rootRef = ref;
  }

  handleProblemAck = (problem: ProblemDTO, data: AckProblemData) => {
    return this.props.onProblemAck(problem, data);
  }

  onExecuteScript = (problem: ProblemDTO, data: AckProblemData) => {
  }

  handlePageSizeChange = (pageSize, pageIndex) => {
    if (this.props.onPageSizeChange) {
      this.props.onPageSizeChange(pageSize, pageIndex);
    }
  }

  handleResizedChange = (newResized, event) => {
    if (this.props.onColumnResize) {
      this.props.onColumnResize(newResized);
    }
  }

  handleExpandedChange = (expanded: any, event: any) => {
    const { problems, pageSize } = this.props;
    const { page } = this.state;
    const expandedProblems = {};

    for (const row in expanded) {
      const rowId = Number(row);
      const problemIndex = pageSize * page + rowId;
      if (expanded[row] && problemIndex < problems.length) {
        const expandedProblem = problems[problemIndex].eventid;
        if (expandedProblem) {
          expandedProblems[expandedProblem] = true;
        }
      }
    }

    const nextExpanded = { ...this.state.expanded };
    nextExpanded[page] = expanded;

    const nextExpandedProblems = { ...this.state.expandedProblems };
    nextExpandedProblems[page] = expandedProblems;

    this.setState({
      expanded: nextExpanded,
      expandedProblems: nextExpandedProblems,
    });
  }

  handleTagClick = (tag: ZBXTag, datasource: string, ctrlKey?: boolean, shiftKey?: boolean) => {
    if (this.props.onTagClick) {
      this.props.onTagClick(tag, datasource, ctrlKey, shiftKey);
    }
  }

  getExpandedPage = (page: number) => {
    const { problems, pageSize } = this.props;
    const { expandedProblems } = this.state;
    const expandedProblemsPage = expandedProblems[page] || {};
    const expandedPage = {};

    // Go through the page and search for expanded problems
    const startIndex = pageSize * page;
    const endIndex = Math.min(startIndex + pageSize, problems.length);
    for (let i = startIndex; i < endIndex; i++) {
      const problem = problems[i];
      if (expandedProblemsPage[problem.eventid]) {
        expandedPage[i - startIndex] = {};
      }
    }

    return expandedPage;
  }

  buildColumns() {
    const result = [];
    const options = this.props.panelOptions;
    const highlightNewerThan = options.highlightNewEvents && options.highlightNewerThan;
    const statusCell = props => StatusCell(props, highlightNewerThan);
    const statusIconCell = props => StatusIconCell(props, highlightNewerThan);
    const hostNameCell = props => <HostCell name={props.original.host} maintenance={props.original.maintenance} />;
    const hostTechNameCell = props => <HostCell name={props.original.hostTechName} maintenance={props.original.maintenance} />;

    const columns = [
      { Header: 'Host', id: 'host', show: options.hostField, Cell: hostNameCell },
      { Header: 'Host (Technical Name)', id: 'hostTechName', show: options.hostTechNameField, Cell: hostTechNameCell },
      { Header: 'Host Groups', accessor: 'groups', show: options.hostGroups, Cell: GroupCell },
      { Header: 'Proxy', accessor: 'proxy', show: options.hostProxy },
      {
        Header: 'Severity', show: options.severityField, className: 'problem-severity', width: 120,
        accessor: problem => problem.priority,
        id: 'severity',
        Cell: props => SeverityCell(props, options.triggerSeverity, options.markAckEvents, options.ackEventColor, options.okEventColor),
      },
      {
        Header: '', id: 'statusIcon', show: options.statusIcon, className: 'problem-status-icon', width: 50,
        accessor: 'value',
        Cell: statusIconCell,
      },
      { Header: 'Status', accessor: 'value', show: options.statusField, width: 100, Cell: statusCell },
      { Header: 'Problem', accessor: 'description', minWidth: 200, Cell: ProblemCell},
      {
        Header: 'Ack', id: 'ack', show: options.ackField, width: 70,
        Cell: props => <AckCell {...props} />
      },
      {
        Header: 'Tags', accessor: 'tags', show: options.showTags, className: 'problem-tags',
        Cell: props => <TagCell {...props} onTagClick={this.handleTagClick} />
      },
      {
        Header: 'Age', className: 'problem-age', width: 100, show: options.ageField, accessor: 'timestamp',
        id: 'age',
        Cell: AgeCell,
      },
      {
        Header: 'Time', className: 'last-change', width: 150, accessor: 'timestamp',
        id: 'lastchange',
        Cell: props => LastChangeCell(props, options.customLastChangeFormat && options.lastChangeFormat),
      },
      { Header: '', className: 'custom-expander', width: 60, expander: true, Expander: CustomExpander },
    ];
    for (const column of columns) {
      if (column.show || column.show === undefined) {
        delete column.show;
        result.push(column);
      }
    }
    return result;
  }

  render() {
    const columns = this.buildColumns();
    this.rootWidth = this.rootRef && this.rootRef.clientWidth;
    const { pageSize, fontSize, panelOptions } = this.props;
    const panelClass = classNames('panel-problems', { [`font-size--${fontSize}`]: fontSize });
    let pageSizeOptions = [5, 10, 20, 25, 50, 100];
    if (pageSize) {
      pageSizeOptions.push(pageSize);
      pageSizeOptions = _.uniq(_.sortBy(pageSizeOptions));
    }

    return (
      <div className={panelClass} ref={this.setRootRef}>
        <ReactTable
          data={this.props.problems}
          columns={columns}
          defaultPageSize={10}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          resized={panelOptions.resizedColumns}
          minRows={0}
          loading={this.props.loading}
          noDataText="No problems found"
          SubComponent={props =>
            <ProblemDetails {...props}
              rootWidth={this.rootWidth}
              timeRange={this.props.timeRange}
              showTimeline={panelOptions.problemTimeline}
              panelId={this.props.panelId}
              getProblemEvents={this.props.getProblemEvents}
              getProblemAlerts={this.props.getProblemAlerts}
              getScripts={this.props.getScripts}
              onProblemAck={this.handleProblemAck}
              onExecuteScript={this.props.onExecuteScript}
              onTagClick={this.handleTagClick}
              subRows={false}
            />
          }
          expanded={this.getExpandedPage(this.state.page)}
          onExpandedChange={this.handleExpandedChange}
          onPageChange={page => this.setState({ page })}
          onPageSizeChange={this.handlePageSizeChange}
          onResizedChange={this.handleResizedChange}
        />
      </div>
    );
  }
}

interface HostCellProps {
  name: string;
  maintenance: boolean;
}

const HostCell: React.FC<HostCellProps> = ({ name, maintenance }) => {
  return (
    <div>
      <span style={{ paddingRight: '0.4rem' }}>{name}</span>
      {maintenance && <FAIcon customClass="fired" icon="wrench" />}
    </div>
  );
};

function SeverityCell(
  props: RTCell<ProblemDTO>,
  problemSeverityDesc: TriggerSeverity[],
  markAckEvents?: boolean,
  ackEventColor?: string,
  okColor = DEFAULT_OK_COLOR
  ) {
  const problem = props.original;
  let color: string;

  let severityDesc: TriggerSeverity;
  const severity = Number(problem.severity);
  severityDesc = _.find(problemSeverityDesc, s => s.priority === severity);
  if (problem.severity && problem.value === '1') {
    severityDesc = _.find(problemSeverityDesc, s => s.priority === severity);
  }

  color = problem.value === '0' ? okColor : severityDesc.color;

  // Mark acknowledged triggers with different color
  if (markAckEvents && problem.acknowledged === "1") {
    color = ackEventColor;
  }

  return (
    <div className='severity-cell' style={{ background: color }}>
      {severityDesc.severity}
    </div>
  );
}

const DEFAULT_OK_COLOR = 'rgb(56, 189, 113)';
const DEFAULT_PROBLEM_COLOR = 'rgb(215, 0, 0)';

function StatusCell(props: RTCell<ProblemDTO>, highlightNewerThan?: string) {
  const status = props.value === '0' ? 'RESOLVED' : 'PROBLEM';
  const color = props.value === '0' ? DEFAULT_OK_COLOR : DEFAULT_PROBLEM_COLOR;
  let newProblem = false;
  if (highlightNewerThan) {
    newProblem = isNewProblem(props.original, highlightNewerThan);
  }
  return (
    <span className={newProblem ? 'problem-status--new' : ''} style={{ color }}>{status}</span>
  );
}

function StatusIconCell(props: RTCell<ProblemDTO>, highlightNewerThan?: string) {
  const status = props.value === '0' ? 'ok' : 'problem';
  let newProblem = false;
  if (highlightNewerThan) {
    newProblem = isNewProblem(props.original, highlightNewerThan);
  }
  const className = classNames('zbx-problem-status-icon',
    { 'problem-status--new': newProblem },
    { 'zbx-problem': props.value === '1' },
    { 'zbx-ok': props.value === '0' },
  );
  return <GFHeartIcon status={status} className={className} />;
}

function GroupCell(props: RTCell<ProblemDTO>) {
  let groups = "";
  if (props.value && props.value.length) {
    groups = props.value.map(g => g.name).join(', ');
  }
  return (
    <span>{groups}</span>
  );
}

function ProblemCell(props: RTCell<ProblemDTO>) {
  const comments = props.original.comments;
  return (
    <div>
      <span className="problem-description">{props.value}</span>
      {/* {comments && <FAIcon icon="file-text-o" customClass="comments-icon" />} */}
    </div>
  );
}

function AgeCell(props: RTCell<ProblemDTO>) {
  const problem = props.original;
  const timestamp = moment.unix(problem.timestamp);
  const age = timestamp.fromNow(true);
  return <span>{age}</span>;
}

function LastChangeCell(props: RTCell<ProblemDTO>, customFormat?: string) {
  const DEFAULT_TIME_FORMAT = "DD MMM YYYY HH:mm:ss";
  const problem = props.original;
  const timestamp = moment.unix(problem.timestamp);
  const format = customFormat || DEFAULT_TIME_FORMAT;
  const lastchange = timestamp.format(format);
  return <span>{lastchange}</span>;
}

interface TagCellProps extends RTCell<ProblemDTO> {
  onTagClick: (tag: ZBXTag, datasource: string, ctrlKey?: boolean, shiftKey?: boolean) => void;
}

class TagCell extends PureComponent<TagCellProps> {
  handleTagClick = (tag: ZBXTag, ctrlKey?: boolean, shiftKey?: boolean) => {
    if (this.props.onTagClick) {
      this.props.onTagClick(tag, this.props.original.datasource, ctrlKey, shiftKey);
    }
  }

  render() {
    const tags = this.props.value || [];
    return [
      tags.map(tag => <EventTag key={tag.tag + tag.value} tag={tag} onClick={this.handleTagClick} /> )
    ];
  }
}

function CustomExpander(props: RTCell<any>) {
  return (
    <span className={props.isExpanded ? "expanded" : ""}>
      <i className="fa fa-info-circle"></i>
    </span>
  );
}
