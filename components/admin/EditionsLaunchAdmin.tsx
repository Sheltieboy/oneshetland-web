"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Panel, Notice, btnPrimary, btnSecondary, btnDanger } from "@/components/editions-manage/kit";
import { useAction } from "@/components/editions-manage/use-action";
import { setLaunchSwitch } from "@/app/admin/editions/launch/actions";
import { SWITCHES, isOn, summary, PUBLIC_KEY, type SwitchKey } from "@/app/admin/editions/launch/switches";

/**
 * The two launch switches. Turning either ON is a one-click action behind a confirmation that lists, in plain words, exactly what becomes true the
 * moment it happens — because "Editions are visible to the public" is the single most consequential setting on the platform, and until now it had
 * no interface at all and was changed by writing to admin_config by hand.
 *
 * Turning a switch OFF needs no confirmation: closing something is always the safe direction.
 *
 * Nothing here decides access. The database decides (editions_enabled / editions_signup_open, both failing closed); this reads the answer, says
 * what it means, and asks the database to change it.
 */
export function EditionsLaunchAdmin({ config }: { config: Record<string, string | undefined> }) {
  const router = useRouter();
  const act = useAction();
  const [confirming, setConfirming] = useState<SwitchKey | null>(null);
  const publicOn = isOn(config, PUBLIC_KEY);
  const signupOn = isOn(config, "editions.signup_open");

  const set = (key: SwitchKey, on: boolean) =>
    act.run(() => setLaunchSwitch(key, on), { success: on ? "Switched on." : "Switched off.", onOk: () => { setConfirming(null); router.refresh(); } });

  return (
    <div className="space-y-6">
      <Panel tone={publicOn ? "warm" : "plain"} title="Where Editions stands right now">
        <p className="text-sm text-ink">{summary(publicOn, signupOn)}</p>
      </Panel>

      {SWITCHES.map((s) => {
        const on = isOn(config, s.key);
        return (
          <Panel key={s.key} title={s.label} sub={s.help}
            action={<span className={"rounded-pill px-3 py-1 text-xs font-bold " + (on ? "bg-emerald-100 text-emerald-900" : "bg-sand text-ink-soft")}>{on ? "On" : "Off"}</span>}>
            {on ? (
              <>
                <p className="mb-4 text-sm text-ink-soft">This is on now. Switching it off takes effect immediately and never deletes anything.</p>
                <button type="button" className={btnDanger} disabled={act.pending} onClick={() => set(s.key, false)}>Switch off</button>
              </>
            ) : confirming === s.key ? (
              <div className="rounded-card border border-amber-300 bg-amber-50/70 p-4">
                <p className="text-sm font-semibold text-ink">Switching this on means, straight away:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">{s.turningOn.map((t) => <li key={t}>{t}</li>)}</ul>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" className={btnPrimary} disabled={act.pending} onClick={() => set(s.key, true)}>{act.pending ? "Switching on…" : "Yes, switch it on"}</button>
                  <button type="button" className={btnSecondary} disabled={act.pending} onClick={() => setConfirming(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <p className="mb-4 text-sm text-ink-soft">While this is off: {s.whileOff}</p>
                <button type="button" className={btnPrimary} disabled={act.pending} onClick={() => setConfirming(s.key)}>Switch on…</button>
              </>
            )}
          </Panel>
        );
      })}
      <Notice msg={act.msg} />
    </div>
  );
}
