/*
Copyright (C) 2015 Ted Meyer

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License version 2 as
published by the Free Software Foundation.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License along
with this program; if not, write to the Free Software Foundation, Inc.,
51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
*/

var nodemailer = require('nodemailer');
var inbox = require("inbox");
var read = require('read');
var app = require('isotope').create(8080, [
  require('isotemplate').engine
]);
app.meta.addunderscore('_dir', function(name, url){
  url.unshift(name);
  return url;
}, true);
app.static = function(url, path) {
  app.get(url+'/_dir', function(res, req, url){
    url.unshift(path);
    res.stream.relative(url.join('/'));
  });
};
app.redirect = function(from, to) {
  app.get(from, function(res){
    app.headers.redirect(res, to);
  });
};
app.static('static', 'ui');

read({ prompt: 'Password: ', silent: true }, function(er, password) {
  var auth = {
    'user': process.argv[2],
    'pass': password
  }
  if (!auth.user) {
    console.log('missing username');
    return;
  }
  if (!auth.pass) {
    console.log('missing password');
    return;
  }
  (function(ctx){
    ctx.read.on("connect", function(){
      app.get('', function(res){
        ctx.read.listMailboxes(function(error, mailboxes){
          app.template(res, 'ui/index.html',{
            'mailtags':mailboxes.map(function(mb){
              return {
                'tagname': mb.name,
                'path': mb.path
              }
            }),
            'senderaddr': auth.user
          });
        });
      });
      app.get('mailbox/_var/_var', function(res, req, mbpath, count){
        res.writeHead(200, {'Content-Type': 'application/json'});
        ctx.read.openMailbox(mbpath, function(error, info){
          ctx.read.listMessages(-10, function(err, messages){
            res.end(JSON.stringify(messages.map(function(each) {
              return {
                'title': each.title,
                'uuid': each.UID,
                'from': each.from
              };
            })));
          });
        });
      });
      app.get('message/_var/_var', function(res, req, mbox, uid){
        res.writeHead(200, {'Content-Type': 'application/json'});
        ctx.read.openMailbox(mbox, function(error, info){
          ctx.read.fetchData(uid, function(error, message){
            console.log(message.flags);
            res.end('{"msg": true}');
          });
        });
      });
      app.post('send/email', function(res, req) {
        app.extract_data(req, function(data) {
          ctx.write.sendMail({
            'from': auth.user,
            'to': data.to,
            'subject': data.subject,
            'text': data.body
          }, function(error, info){
            if(error) {
              res.writeHead(500, {"Content-Type": "text/plain"});
              res.write(JSON.stringify(error));
              res.end("message not sent");
              return;
            }
            app.headers.ok(res);
            res.end('message Sent!');;
          });
        });
      });
    });
    ctx.read.connect();
  })({
    'read': inbox.createConnection(false, "imap.gmail.com", {
      'secureConnection': true,
      'auth': auth
    }),
    'write': nodemailer.createTransport({
      'service': 'Gmail',
      'auth': auth
    })
  });
});
