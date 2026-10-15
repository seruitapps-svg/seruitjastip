<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Snapshot order pricing in a database insert trigger and settle through row-locked RPCs; clients cannot choose fees or double-credit earnings.
- Keep legacy assigned/completed orders on their original settlement version; only unassigned active orders move to the new monetization rules to avoid retroactive wallet changes.
- Render the compact driver fee breakdown through one shared component in the pool, jobs, and detail views to keep amounts consistent.
