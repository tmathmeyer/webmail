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
var app = require('isotope').create(8080,[
  require('isotemplate').engine
]);

var auth = {
  'user': process.argv[2],
  'pass': process.argv[3]
}

console.log(auth);

var transporter = nodemailer.createTransport({
    'service': 'Gmail',
    'auth': auth
});

app.meta.addunderscore('_dir', function(name, url){
  url.unshift(name);
  return url;
}, true);

app.static = function(url, path) {
  app.get(url+'/_dir', function(res, req, url){
    url.unshift(path);
    res.stream.relative(url.join('/'));
  });
}
app.redirect = function(from, to) {
  app.get(from, function(res){
    app.headers.redirect(res, to);
  });
}

app.static('static', 'ui');
app.get('', function(res){
  app.template(res, 'ui/index.html',{
    'mailtags':[
      {'tagname': 'inbox'},
      {'tagname': 'archived'},
      {'tagname': 'spam'}
    ]
  })
});

app.post('send/email', function(res, req) {
  app.extract_data(req, function(data) {
    transporter.sendMail({
      'from': auth.user,
      'to': data.to,
      'subject': data.subject,
      'text': data.body
    }, function(error, info){
      if(error) {
        res.writeHead(500, {"Content-Type": "text/plain"});
        res.write(JSON.stringify(error));
        res.end("fuck");
        console.log(error);
        return;
      }
      app.headers.ok(res);
      res.end('message Sent! ' + JSON.stringify(info));
      console.log(info);
    });
  });
});
