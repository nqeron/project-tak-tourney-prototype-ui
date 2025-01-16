## Deployment

### Deno Deploy

What I did:

```
deno install -gArf jsr:@deno/deployctl
deployctl deploy
```

Configured to github user `devp`. Project name `project-tak-tourney-protot`.

Production deployment: https://devp-project-tak-tourney.deno.dev/

### Integrating with another site

See `integration/redirect-to-beginners-tournament/index.html`.
