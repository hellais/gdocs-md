const fs = require('fs')
const url = require('url')
const readline = require('readline')
const toMarkdown = require('to-markdown')
const google = require('googleapis')
const googleAuth = require('google-auth-library')

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/ooni-docs-sync.js
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
const TOKEN_PATH = TOKEN_DIR + 'ooni-docs-sync.json';

const credentials = require('./client_secret.json')
const clientSecret = credentials.installed.client_secret;
const clientId = credentials.installed.client_id;
const redirectUrl = credentials.installed.redirect_uris[0];
const auth = new googleAuth();
const oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

const getNewToken = (oauth2Client, callback) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oauth2Client.getToken(code, (err, token) => {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

const storeToken = (token) => {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

const listFiles = (auth) => {
  var service = google.drive('v3');
  service.files.list({
    auth: auth,
    pageSize: 100,
    fields: "nextPageToken, files(id, name)",
    supportsTeamDrives: true,
    includeTeamDriveItems: true
  }, function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }
    //console.log(response)
    var files = response.files;
    if (files.length == 0) {
      console.log('No files found.');
    } else {
      console.log('Files:');
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        //console.log(Object.keys(file))
        console.log('%s (%s)', file.name, file.id);
      }
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      })
      rl.question('Enter the fileId you want: ', (fileId) => {
        rl.close();
        service.files.export({
          auth: auth,
          supportsTeamDrives: true,
          includeTeamDriveItems: true,
          fileId: fileId,
          // See: https://developers.google.com/drive/v3/web/manage-downloads
          mimeType: 'text/html',
          supportsTeamDrives: true
        }, {encoding: 'utf-8'}, function(err, data) {
          if (err) {
            console.log(err)
            return
          }
          // Google spams us with https://www.google.com/url?q= links
          const linkFixer = {
            filter: 'a',
            replacement: function(innerHtml, node) {
              let href = node.href
              if (node.href.startsWith('https://www.google.com/url')) {
                const hrefUrl = new url.URL(node.href)
                href = hrefUrl.searchParams.get('q')
                console.log(href)
              }
              return `[${innerHtml}](${href}) `
            }
          }
          const spanFixer = {
            filter: 'span',
            replacement: function(innerHtml, node) {
              if (node.style.fontWeight === '700') {
                return `**${innerHtml}**`
              }
              return innerHtml
            }
          }
          const mdOptions = {
            converters: [
              linkFixer,
              spanFixer
            ]
          }
          const dstPath = fileId+'-export.md'
          const dstHtmlPath = fileId+'-export.html'
          const mdData = toMarkdown(data, mdOptions)
          fs.writeFile(dstHtmlPath, data, (err) => {
            fs.writeFile(dstPath, mdData, (err) => {
                if(err) {
                    return console.log(err);
                }
                console.log(`${dstPath} & ${dstHtmlPath} written!`);
            });
          })
        })
      })
    }
  });
}

// Check if we have previously stored a token.
fs.readFile(TOKEN_PATH, (err, token) => {
	if (err) {
		getNewToken(oauth2Client, listFiles);
	} else {
		oauth2Client.credentials = JSON.parse(token);
		listFiles(oauth2Client);
	}
})
