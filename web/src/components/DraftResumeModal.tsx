import { Button, Modal } from "antd";

type Props = {
  open: boolean;
  typeLabel: string;
  onContinue: () => void;
  onRestart: () => void;
  onCancel: () => void;
};

export function DraftResumeModal(props: Props) {
  return (
    <Modal
      title="发现草稿"
      open={props.open}
      onCancel={props.onCancel}
      footer={[
        <Button key="cancel" onClick={props.onCancel}>
          取消
        </Button>,
        <Button key="restart" onClick={props.onRestart}>
          重新开始填写
        </Button>,
        <Button key="continue" type="primary" onClick={props.onContinue}>
          继续上次草稿
        </Button>
      ]}
    >
      <div className="text-sm text-slate-700">
        你之前填写过{props.typeLabel}，是否继续上次草稿？
      </div>
      <div className="mt-2 text-xs text-slate-500">
        选择“重新开始填写”会创建一份新的草稿，不会删除旧草稿。
      </div>
    </Modal>
  );
}
