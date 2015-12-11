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
document.addEventListener("DOMContentLoaded", function() {
  (function(ctx) {
    panelids=[
      'compositionform',
      'maillisting',
      'PGPControlPanel'
    ]
    ctx.listen('compose', 'click', function() {
      panelids.forEach(function(each) {
        ctx.hide(each);
      });
      ctx.unhide('compositionform');
    });
    ctx.listen('pgpcontrol', 'click', function() {
      panelids.forEach(function(each) {
        ctx.hide(each);
      });
      ctx.unhide('PGPControlPanel');
    });
    ctx.listen('trash', 'click', function() {
      panelids.forEach(function(each) {
        ctx.hide(each);
      });
      ctx.unhide('maillisting');
    });
    ctx.listen('importkey', 'click', function() {
      ['pgpkeyimport', 'pgpkeyinfo'].forEach(function(each) {
        ctx.hide(each);
      });
      ctx.unhide('pgpkeyimport');
    });
    ctx.listen('submitpubkey', 'click', function() {
      var keyArmored = document.getElementById('pubkeysubmit');
      var pubkey = window.openpgp.key.readArmored(keyArmored.value);
      window.openpgp.encryptMessage(pubkey.keys, 'test').then(function(msg){
        pubkey = pubkey.keys[0];
        var pubkeys = localStorage.getItem('pubkeys');
            pubkeys = pubkeys ? JSON.parse(pubkeys) : {};
        pubkey.users.forEach(function(user) {
          pubkeys[user.userId.userid] = keyArmored.value;
        });
        localStorage.setItem('pubkeys', JSON.stringify(pubkeys));

        ctx.setPGPElement(keyArmored, ctx);
        ['pgpkeyimport', 'pgpkeyinfo'].forEach(function(each) {
          ctx.hide(each);
        });
        ctx.repopulateKeys(ctx);
        ctx.unhide('pgpkeyinfo');
      }).catch(function(err) {
        console.error(err);
        alert('cannot add key, is invalid');
      });
    })
    ctx.listen('send', 'click', function() {
      var email = document.getElementById('writeEmail').value;
      (function(send){
        if (ctx.currentemail.encryption) {
          var pubkey = window.openpgp.key.readArmored(ctx.currentemail.key);
          window.openpgp.encryptMessage(pubkey.keys, email).then(send).catch(function(error){
            console.error(error);
          })
        } else {
          send(email);
        }
      })(function(pgpMessage) {
        $.post('/send/email', {
          'to': document.getElementById('to').value,
          'subject': document.getElementById('subject').value,
          'body': pgpMessage
        }).done(function(data) {
          console.log(pgpMessage);
          alert(data);
        });
      });
    });
    ctx.listen('encrypt', 'click', function() {
      var email = document.getElementById('to').value;
      keys = ctx.getPubKeys();

      var matching = Object.keys(keys).filter(function(each){
        return each.indexOf(email) > -1;
      });

      if (matching.length != 1) {
        alert('either missing a key, or duplicate emails. Error: '+matching.length);
        return;
      }

      ctx.currentemail.key = keys[matching[0]];
      ctx.currentemail.encryption = true;
    });
    ctx.listen('genkey', 'click', function() {
      ctx.generateKeyPair(ctx);
    });
    ctx.repopulateKeys(ctx);
  })({
    currentemail: {
      'encryption': false,
      'key': null
    },
    listen: function(name, event, fn) {
      document.getElementById(name).addEventListener(event, fn);
    },
    hide: function(name) {
      document.getElementById(name).style.display = 'none';
    },
    unhide: function(name) {
      document.getElementById(name).style.display = 'block';
    },
    generateKeyPair: function(ctx) {
      var name = prompt("Enter your full name", "");
      if (!name) {
        return false;
      }
      while(name.length < 5) {
        alert("Full name needs to be at least 5 characters");
        name = prompt("Enter your full name", name);
        if (!name) {
          return false;
        }
      }
      var email = prompt("Enter your email", "");
      if (!email) {
        return false;
      }
      while(ctx.validateEmail(email)) {
        alert("Please enter a valid email");
        email = prompt("Enter your email", email);
        if (!email) {
          return false;
        }
      }
      var password;
      var pass2;
      do {
        password = prompt("Please enter a secure password (greater than 15 characters)", "");
        if (!password) {
          return false;
        }
        while(password.length < 15) {
          alert("password not long enough");
          password = prompt("Please enter a secure password (greater than 15 characters)", "");
          if (!password) {
            return false;
          }
        }
        pass2 = prompt("Please re-enter the password", '');
        if (!pass2) {
          return false;
        }
        while(pass2 !== password) {
          alert('Passwords do not match');
        }
      } while(pass2 !== password);
      var options = {
        numBits: 2048,
        userId: name + ' <' + email + '>',
        passphrase: password
      };
      window.openpgp.generateKeyPair(options).then(function(keypair){
        var privkey = keypair.privateKeyArmored;
        var pubkey = keypair.publicKeyArmored;
        var local = localStorage.getItem('privkeys');
        local = local ? JSON.parse(local) : {};
        local[options.userId] = privkey;
        localStorage.setItem('privkeys', JSON.stringify(local));
        local = localStorage.getItem('pubkeys');
        local = local ? JSON.parse(local) : {};
        local[options.userId] = pubkey;
        localStorage.setItem('pubkeys', JSON.stringify(local));
        ctx.repopulateKeys(ctx);
      }).catch(function(error) {
        alert('generation failed');
        alert(error);
      });
    },
    setPGPElement: function(pgpkey, ctx) {
      pgpkey = window.openpgp.key.readArmored(pgpkey);
      var keyinspector = ctx.createElement('div', 'keyDetailView', [], {
        'type': 'nodes',
        'content': [
          ctx.createElement('div', 'keyFingerprint', [], {
            'type': 'nodes',
            'content': [
              ctx.createElement('div', '', ['keyfingerprintlabel'], {
                'type': 'text',
                'content': 'Fingerprint: '
              }),
              ctx.createElement('div', '', ['keyfingerprinthash'], {
                'type': 'text',
                'content': pgpkey.keys[0].primaryKey.fingerprint
              })
            ]
          }),
          ctx.createElement('div', 'keyCreated', [], {
            'type': 'nodes',
            'content': [
              ctx.createElement('div', '', ['keycreatedlabel'], {
                'type': 'text',
                'content': 'Created: '
              }),
              ctx.createElement('div', '', ['keycreatedvalue'], {
                'type': 'text',
                'content': pgpkey.keys[0].primaryKey.created
              })
            ]
          })
        ]
      });
      document.getElementById('pgpkeyinfo').innerHTML = '';
      document.getElementById('pgpkeyinfo').appendChild(keyinspector);
    },
    createElement: function(type, id, classes, content, onclick) {
      var escapeHtml = function(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
      };
      var result = document.createElement(type);
      result.id = id;
      result.className = classes?classes.join(' '):'';
      if (content) {
        if (content.type === 'html') {
          result.innerHTML = content.content;
        } else if (content.type === 'text') {
          result.innerHTML = escapeHtml(content.content);
        } else if (content.type === 'nodes') {
          content.content.forEach(function(node) {
            result.appendChild(node);
          });
        }
      }
      result.onclick = onclick;
      return result;
    },
    validateEmail: function(email) {
      var re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
      return !re.test(email);
    },
    getPubKeys(ctx) {
      var r = localStorage.getItem('pubkeys');
      if (r) {
        return JSON.parse(r);
      }
      return {};
    },
    repopulateKeys: function(ctx) {
      keys = ctx.getPubKeys(ctx);
      if(keys) {
        var keylist = document.getElementById('pgpkeylist');
        Object.keys(keys).map(function(each) {
          return ctx.createElement('div', '', ['pgpKeyElement'], {
            'type': 'text',
            'content': each
          }, function(event){
            ['pgpkeyimport', 'pgpkeyinfo'].forEach(function(each) {
              ctx.hide(each);
            });
            ctx.unhide('pgpkeyinfo');
            ctx.setPGPElement(keys[each], ctx);
          });
        }).forEach(function(each) {
          keylist.appendChild(each);
        })
      } else {
        document.getElementById('pgpkeylist').innerHTML =
          '<div class="pgpKeyElement"> No PGP keys added </div>'
      }
    }
  })
});
