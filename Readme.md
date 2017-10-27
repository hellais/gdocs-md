# Gdocs to Markdown

This CLI tool is used to convert google docs to markdown for easy import into
markdown.

To get it started you first need a `client_secrets.json` inside of the root of
this repo.

This can be generated following these instructions: https://developers.google.com/drive/v3/web/quickstart/nodejs#step_1_turn_on_the_api_name

Then run:

```
node convert.js
```

This will prompt you for which document ID you want to convert. It will be
written to your current working directory.
