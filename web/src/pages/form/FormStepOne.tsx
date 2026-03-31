import { FormSchemaSection } from "../../components/FormSchemaSection";
import type { SectionDef } from "../../utils/formSchema";

export function FormStepOne(props: { sections: SectionDef[]; contentSnapshot: any }) {
  return (
    <div className="space-y-4">
      {props.sections.map((s) => (
        <FormSchemaSection key={s.key} section={s} contentSnapshot={props.contentSnapshot} />
      ))}
    </div>
  );
}

