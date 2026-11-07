"use client";

import { AlertTriangle, MessageSquareQuote } from "lucide-react";
import { Card, Dot, PageTitle, Pill, STATUS_COLOR } from "@/components/ui";
import { CLASS_TOPICS, topicStatus } from "@/lib/course";

const AMBIGUITIES = [
  { text: "Does the 1500 words include references?", count: 14 },
  { text: "Do textbooks count as academic sources?", count: 5 },
  { text: "Evaluate one study or several?", count: 3 },
];

export default function Heatmap() {
  const weeks = [...new Set(CLASS_TOPICS.map((t) => t.week))];
  const total = (t: (typeof CLASS_TOPICS)[number]) => t.red + t.amber + t.green;
  const secure = Math.round((CLASS_TOPICS.reduce((n, t) => n + t.green / total(t), 0) / CLASS_TOPICS.length) * 100);
  const hardest = CLASS_TOPICS.filter((t) => topicStatus(t) === "red");
  const watch = CLASS_TOPICS.filter((t) => topicStatus(t) === "amber");
  const quotes = CLASS_TOPICS.filter((t) => t.quote && topicStatus(t) !== "green");

  return (
    <>
      <PageTitle title="Class insights" sub="How the whole class is doing on each week's content. Demo data for 20 students, labelled." />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-xs text-ink2">Weekly labs covered</p><p className="tnum mt-1 text-2xl font-semibold">{weeks.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-ink2">Average concepts secure</p><p className="tnum mt-1 text-2xl font-semibold">{secure}%</p></Card>
        <Card className="p-4"><p className="text-xs text-ink2">Topics to address in class</p><p className="tnum mt-1 text-2xl font-semibold">{hardest.length}</p></Card>
      </div>

      {hardest.length > 0 && (
        <Card className="mb-5 border-[#f5c2bd] bg-[#fff8f7] p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><AlertTriangle size={16} className="text-red" /> Worth addressing with the whole class</div>
          <ul className="space-y-1.5">
            {hardest.map((t) => <li key={t.concept} className="flex items-center gap-2"><Dot status="red" /><span className="flex-1"><span className="font-medium">{t.concept}</span> <span className="text-ink2">(Week {t.week}, {t.lab})</span></span><span className="tnum text-xs text-ink2">{t.red} of {total(t)} red</span></li>)}
          </ul>
          {watch.length > 0 && <p className="mt-3 text-sm text-ink2">Keep an eye on: {watch.map((t) => t.concept).join(", ")}.</p>}
        </Card>
      )}

      <div className="mb-5 space-y-4">
        {weeks.map((w) => {
          const items = CLASS_TOPICS.filter((t) => t.week === w);
          return (
            <Card key={w} className="p-5">
              <h3 className="mb-3 text-sm font-semibold">Week {w}: {items[0].lab}</h3>
              <div className="space-y-4">
                {items.map((t) => (
                  <div key={t.concept}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2">{t.concept}<Pill status={topicStatus(t)}>{topicStatus(t) === "green" ? "Secure" : topicStatus(t) === "amber" ? "Watch" : "Needs attention"}</Pill></span>
                      <span className="tnum text-xs text-ink2">{t.red} red · {t.amber} amber · {t.green} green</span>
                    </div>
                    <div className="flex h-3 overflow-hidden rounded bg-[#efefec]" role="img" aria-label={`${t.concept}: ${t.red} red, ${t.amber} amber, ${t.green} green`}>
                      {(["red", "amber", "green"] as const).map((s) => <div key={s} style={{ width: `${(t[s] / total(t)) * 100}%`, background: STATUS_COLOR[s] }} />)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><MessageSquareQuote size={16} /> From students&apos; chats with Max</div>
          <ul className="space-y-3">
            {quotes.map((t) => <li key={t.concept} className="border-l-2 border-[#14284b] pl-3"><p className="text-sm font-medium">Your class struggles with {t.concept.toLowerCase()}.</p><p className="text-sm text-ink2">{t.quote}</p></li>)}
          </ul>
        </Card>
        <Card className="border-[#e8a33d66] bg-[#fffaf0] p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><AlertTriangle size={16} className="text-amber-ink" /> Your brief is ambiguous</div>
          <ul className="space-y-2">
            {AMBIGUITIES.map((a) => <li key={a.text} className="flex items-center gap-3"><span className="flex-1">{a.text}</span><span className="tnum rounded bg-white px-2.5 py-0.5 text-xs font-medium ring-1 ring-[#e8a33d66]">{a.count} students</span></li>)}
          </ul>
        </Card>
      </div>
    </>
  );
}
