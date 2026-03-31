import { AppCard } from "../../components/AppCard";
import { FormSchemaSection } from "../../components/FormSchemaSection";
import { MajorPreferenceTable } from "../../components/MajorPreferenceTable";
import type { SectionDef } from "../../utils/formSchema";

export function FormStepTwo(props: {
  sections: SectionDef[];
  contentSnapshot: any;
  majorCategories: readonly string[];
  readonly?: boolean;
}) {
  return (
    <div className="space-y-4">
      <AppCard>
        <div className="text-sm font-semibold text-slate-900">专业大类说明</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {props.majorCategories.map((c) => (
            <span key={c} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
              {c}
            </span>
          ))}
        </div>
      </AppCard>

      <AppCard>
        <div className="text-sm font-semibold text-slate-900">专业意向表格</div>
        <div className="mt-2">
          <MajorPreferenceTable categories={props.majorCategories} maxRows={20} readonly={props.readonly} />
        </div>
      </AppCard>

      {props.sections.map((s) => (
        <FormSchemaSection key={s.key} section={s} contentSnapshot={props.contentSnapshot} />
      ))}
    </div>
  );
}

