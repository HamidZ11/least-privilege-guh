# Unlearn design
Calm, light SaaS (Attio / Linear style). Quiet everywhere except the hex mastery map.

## Tokens
- Page bg #F3F3F1 · app panel #FFFFFF, rounded-2xl, 1px border rgba(0,0,0,0.08), shadow-sm only
- Text #1A1A1A / secondary #6B6B6B / muted #9A9A9A
- Status: green #2E9D5B · amber #E8A33D · red #D9483B, used as dots + soft pills (12% bg)
- Primary button #1F1F1F, rounded-lg, ONE per screen
- Font Inter or Geist, 14px base, headings -0.01em, tabular-nums for numbers
- 4px spacing scale, lucide-react icons 16px
- Banned: gradients, purple, emoji, glow, more than one accent

## Layout
Left sidebar 240px (grouped, small muted labels, active item = grey pill, count badges right) · top bar with page title left and "✳ Ask Max" pill right · content area.
Sidebar: Essentials (Overview, Submit) · Practise (Rubric Check, Teach Max, Viva) · Needs attention (red-dot concepts) · Student/Lecturer toggle → Viva Reports, Class Heatmap.

## Signature element
Hex grid (SVG) for the mastery map and class heatmap. Only used on Overview and Class Heatmap.

## Pages
/overview stat cards + hex map · /submit centred upload card · /rubric criteria table + gap notes + Download PDF · /teach chat with Max · /viva question card + timer + mic + answered list · /lecturer/reports student table + side panel with flags · /lecturer/heatmap hex grid
Empty/loading states always designed (skeletons, a friendly empty card).
