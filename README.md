Landing page for bejoybeauty.com.

Plain static HTML, CSS and JS. No framework, no build step.

Structure
/
├── index.html      # landing page (must stay at the repo root)
├── css/            # stylesheets
├── js/             # scripts
└── images/         # image assets

Keep asset paths relative (e.g. images/logo.png) so they work locally and on Netlify.

Run locally

Open index.html in a browser, or serve the folder so paths behave like production:

npx serve .
Deploy

Hosted on Netlify, connected to this repo.

Every push to main redeploys the live site automatically.
Build command: none
Publish directory: repo root

Check the deploy status in the Netlify dashboard under Deploys.

Domain and DNS
Domain registered through Google Workspace (managed at Squarespace Domains).
DNS stays at Squarespace. Nameservers are not moved to Netlify.
Website records:
A on @ pointing to Netlify's load balancer
CNAME on www pointing to the site's .netlify.app address
HTTPS is issued automatically by Netlify.

Do not edit or delete the MX or TXT records. They run email for info@bejoybeauty.com through Google Workspace.

Contact

info@bejoybeauty.com
