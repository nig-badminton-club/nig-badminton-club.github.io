# NIG Badminton Club / 遺伝研バドミントン部

[![CI](https://github.com/nig-badminton-club/nig-badminton-club.github.io/actions/workflows/ci.yml/badge.svg)](https://github.com/nig-badminton-club/nig-badminton-club.github.io/actions/workflows/ci.yml)
[![Website](https://img.shields.io/badge/website-live-2ea44f)](https://nig-badminton-club.github.io/)

Public website for the NIG Badminton Club.

This repository publishes the club website with GitHub Pages. It
contains only public-facing site assets and aggregate public data. Private
attendance responses, guest contact details, role assignment history,
confirmation tokens, Google Sheets administration data, and Apps Script
deployment configuration should not be committed to this public repository.

## Website

Live site: [nig-badminton-club.github.io](https://nig-badminton-club.github.io/).
The organization site is already configured. Normal changes use the existing
CI and Pages delivery; see [development and delivery](DEVELOPMENT.md).

## Site Contents

- `docs/index.html`: schedule, next practice, map, and participation policy
- `docs/attendance.html`: yearly historical participation chart, totals and TSV download
- `docs/about.html`: club overview, practice photo, member count summary, and yearly officers
- `docs/workflow.html`: weekly attendance and role-assignment workflow
- `docs/role-assignment.html`: setup/return role assignment method
- `docs/admin.html`: public entry point to the protected Apps Script admin console
- `docs/join.html`: joining, leaving, email-address changes, and manager contact
- `docs/privacy.html`: public data, Form data, access, and correction/deletion policy
- `docs/favicon.svg`: site favicon
- `docs/assets/`: CSS and JavaScript for the static site
- `docs/data/public.json`: committed aggregate schedule and attendance data
- `docs/data/config.js`: optional live public-data endpoint configuration

The site is bilingual Japanese/English.

## Public Data Policy

The website may publish:

- upcoming practice dates, times, locations, and status, plus dates retained
  with historical aggregate records
- current and historical aggregate attendance and guest counts, including the
  yearly chart and downloadable TSV; these describe Form responses, not
  confirmed physical attendance
- aggregate key-pickup status without assignee identity, confirmation tokens, or timestamps
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
Thursday role-assignment email may share the guest count by respondent account
with the whole club, but not guest names, relationships, affiliations, or contact
details.

The [privacy page](docs/privacy.html) explains collection, private member-level
statistics, historical aggregate publication and access. Update both languages
there whenever the site's data use or public fields change.

## GitHub Pages Deployment

On pushes to `main`, `.github/workflows/ci.yml` validates the commit once and
then calls the reusable Pages workflow to publish that same commit’s `docs/`
directory. See [development and recovery](DEVELOPMENT.md) for the checks and
manual/recovery entry points.

Initial repository creation is separate from routine delivery; the
[initial setup reference](DEVELOPMENT.md#initial-site-setup-reference) is for
recreating the site in a separate environment.

## Local Preview

Use Node 24 (selected in `.node-version`) and Python 3. From the repository root:

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
The site warns visitors when committed aggregate data is more than about one
week old.

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

This repository alone is enough to preview, validate and publish the website;
no Google login is needed for local checks. Clone the private repository when
maintaining Forms, Calendar, Sheets, triggers or email automation, and follow its
separate authorization and deployment instructions. Do not recreate production
resources as part of a routine site update.

## License

No open-source license has been selected yet. Until a license is added, reuse of
the repository contents is not granted by default.
