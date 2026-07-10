# NIG Badminton Club / 遺伝研バドミントン部

[![CI](https://github.com/nig-badminton-club/nig-badminton-club.github.io/actions/workflows/ci.yml/badge.svg)](https://github.com/nig-badminton-club/nig-badminton-club.github.io/actions/workflows/ci.yml)
[![Deploy GitHub Pages](https://github.com/nig-badminton-club/nig-badminton-club.github.io/actions/workflows/pages.yml/badge.svg)](https://github.com/nig-badminton-club/nig-badminton-club.github.io/actions/workflows/pages.yml)
[![Website](https://img.shields.io/badge/website-live-2ea44f)](https://nig-badminton-club.github.io/)

Public website for the NIG Badminton Club.

This repository is intended to publish the club website with GitHub Pages. It
contains only public-facing site assets and aggregate public data. Private
attendance responses, guest contact details, role assignment history,
confirmation tokens, Google Sheets administration data, and Apps Script
deployment configuration should not be committed to this public repository.

## Website

Preferred public URL:

```text
https://nig-badminton-club.github.io/
```

To use this root organization-site URL on GitHub Pages, create the repository
under the `nig-badminton-club` organization with this exact name:

```text
nig-badminton-club.github.io
```

If a different repository name is used, GitHub Pages will publish it as a
project site instead, for example:

```text
https://nig-badminton-club.github.io/<repository-name>/
```

## Site Contents

- `docs/index.html`: schedule, next practice, map, and participation policy
- `docs/about.html`: club overview, practice photo, member count summary, and yearly officers
- `docs/workflow.html`: weekly attendance and role-assignment workflow
- `docs/role-assignment.html`: setup/return role assignment method
- `docs/admin.html`: public entry point to the protected Apps Script admin console
- `docs/join.html`: joining, leaving, address-change, and manager-contact page
- `docs/privacy.html`: public data, Form data, access, and correction/deletion policy
- `docs/favicon.svg`: site favicon
- `docs/assets/`: CSS and JavaScript for the static site
- `docs/data/public.json`: public fallback data for the static site
- `docs/data/config.js`: optional live public-data endpoint configuration

The site is bilingual Japanese/English.

## Public Data Policy

The website may publish:

- upcoming practice dates, times, locations, and status
- aggregate attendance counts
- aggregate guest counts
- response and role status without member identities
- aggregate Google Group member counts split into NIG and external members
- public participation policy and joining instructions

The website must not publish:

- raw attendance response rows
- participant email addresses
- participant account IDs and assigned member names
- guest names, affiliations, relationships, or contact details
- key pickup confirmation tokens or personal confirmation links
- private spreadsheet URLs or edit URLs
- maintainer-only practice-date operation instructions
- Apps Script project edit URLs, execution logs, or deployment-management notes
- Google API tokens, GitHub tokens, OAuth refresh tokens, or local clasp files

Guest details entered in the attendance form are for club management. The
Thursday role-assignment email may share the guest count by responding account
with the whole club, but not guest names, relationships, affiliations, or contact
details.

## GitHub Pages Deployment

This repository includes a GitHub Actions workflow at
`.github/workflows/pages.yml`. On pushes to `main`, the workflow publishes the
`docs/` directory to GitHub Pages.

The expected setup is:

1. Create `nig-badminton-club.github.io` under the `nig-badminton-club` organization.
2. Push this repository to `main`.
3. In repository settings, enable GitHub Pages with GitHub Actions as the source.
4. Confirm the deployed site at `https://nig-badminton-club.github.io/`.

## Local Preview

From the repository root:

```sh
npm ci
npm run check
npm run serve
```

Then open:

```text
http://localhost:4173/
```

## Public Data Updates

The static site reads aggregate public data from `docs/data/public.json`.
The private Apps Script automation can update that file through the GitHub API
when its script properties include a GitHub token with permission to write this
repository.

`docs/data/config.js` intentionally leaves the public JSONP endpoint blank for
anonymous visitors. The protected admin-console URL remains configured there.
The site warns visitors when committed aggregate data is more than eight hours
old.

Any automated public-data update must write only the same safe public fields as
`docs/data/public.json`. Do not expose private Sheets tabs, form response rows,
guest details, or key pickup tokens from a web endpoint or committed JSON file.

## Private Automation

This public website repository is operated together with a private operations
repository:

```text
https://github.com/nig-badminton-club/nig-badminton-club-ops
```

The private repository stores the Google Apps Script automation, local clasp
project settings, sheet/template tooling, protected admin-console source, and
maintainer-only setup notes. Those files can contain operational resource IDs
and implementation details that are unnecessary for the public website.

To resume development from a clean machine, maintainers should clone both
repositories, then authenticate locally with `clasp login`. The public
repository is enough to preview and publish the website; the private repository
is needed to update Forms, Calendar, Sheets, triggers, and email automation.

Before production launch, maintainers should separately confirm that:

- automated email delivery is intentionally enabled only when ready
- Google Group and Calendar sharing settings are intentional
- the attendance form collects Google account email automatically
- the spreadsheet is private to the owner and explicitly shared administrators
- guest details remain in private Sheets only
- the public JSON file contains aggregate public data only
- the practice photo remains appropriate for public display

## License

No open-source license has been selected yet. Until a license is added, reuse of
the repository contents is not granted by default.
