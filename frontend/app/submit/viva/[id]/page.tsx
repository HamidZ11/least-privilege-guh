"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft, Upload } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import ChatPanel from "@/components/ChatPanel";
import { Empty, PageTitle, PrimaryButton, Skeleton } from "@/components/ui";
import type { Session } from "@/lib/types";

export default function VivaPage() {
  const { id } = useParams<{ id: string }>();
  const { assessments, patchAssessment, notify, markRead, ready, student } = useApp();
  const a = assessments.find((x) => x.id === id);

  const onSession = (s: Session) => {
    if (!a) return;
    if (s.mode === "recap" && a.status === "viva_due") {
      patchAssessment(a.id, { session: s, status: "awaiting_review" });
    } else {
      patchAssessment(a.id, { session: s });
    }
  };

  // When the viva finishes: clear the student's nudge and tell the module leader.
  useEffect(() => {
    if (a?.status === "awaiting_review") {
      markRead("/submit");
      notify("lecturer", `${student} completed the viva for "${a.title}". Evidence is ready for your decision.`, "/lecturer/reports");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.status === "awaiting_review"]);

  if (!ready) return <Skeleton className="h-64 w-full" />;
  if (!a || !a.session)
    return (
      <Empty
        icon={<Upload size={18} />}
        title="Submit your work first"
        body="Your viva is about your own submission, so we need it first."
        action={<Link href="/submit"><PrimaryButton>Go to Submit work</PrimaryButton></Link>}
      />
    );

  return (
    <>
      <Link href="/submit" className="mb-3 inline-flex items-center gap-1 text-sm text-ink2 hover:text-ink"><ArrowLeft size={14} /> Submit work</Link>
      <PageTitle title={`Viva: ${a.title}`} sub="A short spoken conversation about your own work. The timer is a guide, it never cuts you off." />
      <ChatPanel kind="viva" session={a.session} onSession={onSession} railTitle="Topics covered" />
    </>
  );
}
