"use client";

import type { ScriptSportKey } from "@/lib/fixtures-shared";

import {
  ScriptSlotFormBaseball,
  ScriptSlotFormBasketball,
  ScriptSlotFormNfl,
} from "./script-slot-form-variants";
import { ScriptSlotFormSoccer, type ScriptSlotFormBaseProps } from "./script-slot-form-soccer";

export type ScriptSlotFormProps = ScriptSlotFormBaseProps & {
  sportKey: ScriptSportKey;
};

export function ScriptSlotForm({ sportKey, ...rest }: ScriptSlotFormProps) {
  switch (sportKey) {
    case "basketball":
      return <ScriptSlotFormBasketball {...rest} />;
    case "american_football":
      return <ScriptSlotFormNfl {...rest} />;
    case "baseball":
      return <ScriptSlotFormBaseball {...rest} />;
    default:
      return <ScriptSlotFormSoccer {...rest} />;
  }
}
