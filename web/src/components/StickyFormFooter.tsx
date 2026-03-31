import { Button } from "antd";
import type { ReactNode } from "react";

type Props = {
  left?: ReactNode;
  right?: ReactNode;
  onPrev?: () => void;
  onNext?: () => void;
  onSave?: () => void;
  onSubmit?: () => void;
  disableSave?: boolean;
  disableSubmit?: boolean;
  loadingSave?: boolean;
  loadingSubmit?: boolean;
  currentStep: number;
  totalSteps: number;
  readonly?: boolean;
};

export function StickyFormFooter(props: Props) {
  const showPrev = props.currentStep > 0;
  const showNext = props.currentStep < props.totalSteps - 1;
  const showSave = !props.readonly;
  const showSubmit = !props.readonly && props.currentStep === props.totalSteps - 1;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          {props.left}
          {showPrev ? (
            <Button onClick={props.onPrev} disabled={props.currentStep <= 0}>
              上一步
            </Button>
          ) : null}
          {showNext ? (
            <Button
              type="primary"
              onClick={props.onNext}
              disabled={props.currentStep >= props.totalSteps - 1}
            >
              下一步
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {props.right}
          {showSave ? (
            <Button
              onClick={props.onSave}
              disabled={props.disableSave}
              loading={props.loadingSave}
            >
              保存草稿
            </Button>
          ) : null}
          {showSubmit ? (
            <Button
              type="primary"
              danger
              onClick={props.onSubmit}
              disabled={props.disableSubmit}
              loading={props.loadingSubmit}
            >
              提交
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
