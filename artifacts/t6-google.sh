#!/usr/bin/env bash
# Google identity tests. The OAuth consent screen cannot be automated here, but
# the session that the callback mints is HMAC-signed with the same secret, so a
# locally-signed cookie exercises the real resolution, onboarding and linking
# code in the Worker. A tampered signature must be refused.
B=http://localhost:3001
O='Origin: http://localhost:5173'
CT='content-type: application/json'
IP="10.$((RANDOM%250)).$((RANDOM%250)).$((RANDOM%250))"
curl(){ command curl -H "cf-connecting-ip: $IP" "$@"; }
say(){ printf '%s\n' "$*"; }
R=$RANDOM
GSUB="google:qa-$R"
GEMAIL="gqa$R@example.com"
GUSER="gqa$R"

cookie(){
  node -e '
const crypto=require("crypto"),fs=require("fs");
const env=Object.fromEntries(fs.readFileSync(".dev.vars","utf8").split(/\r?\n/).filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const [,sub,email,name,verified]=process.argv;
const payload=Buffer.from(JSON.stringify({sub,name,email,email_verified:verified==="1",exp:Date.now()+3600000})).toString("base64url");
if(!env.GOOGLE_CLIENT_SECRET){console.error("no secret");process.exit(1)}
const sig=crypto.createHmac("sha256","recall-google-session:"+env.GOOGLE_CLIENT_SECRET).update(payload).digest("base64url");
process.stdout.write(payload+"."+sig);
' "$1" "$2" "$3" "$4"
}
field(){ node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); const p=process.argv[2].split("."); let v=j; for(const k of p) v=v?.[k]; console.log(typeof v==="object"?JSON.stringify(v):String(v))' "$1" "$2"; }

GC=$(cookie "$GSUB" "$GEMAIL" "G Qa" 1)
# Tamper the payload, not the last base64 character: the final character of a
# 32-byte signature carries padding bits, so changing it can decode to the same
# bytes and still verify.
BAD="Z${GC:1}"
say "G0 tampered signature -> $(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: recall_user=$BAD" $B/api/me) (want 401)"

C1=$(curl -s -o /tmp/g1.json -w '%{http_code}' -H "Cookie: recall_user=$GC" $B/api/me)
say "G1 new google -> $C1 needsUsername=$(field /tmp/g1.json user.needsUsername) sub=$(field /tmp/g1.json user.sub) sid=$(field /tmp/g1.json user.studentId) cap=$(field /tmp/g1.json capabilities.auth)"

C2=$(curl -s -o /tmp/g2.json -w '%{http_code}' -H "Cookie: recall_user=$GC" -H "$O" -H "$CT" -d "{\"username\":\"$GUSER\"}" $B/api/profile/username)
say "G2 claim username -> $C2 $(cat /tmp/g2.json)"

C3=$(curl -s -o /tmp/g3.json -w '%{http_code}' -H "Cookie: recall_user=$GC" $B/api/me)
say "G3 same google again -> $C3 username=$(field /tmp/g3.json user.username) needsUsername=$(field /tmp/g3.json user.needsUsername) sub=$(field /tmp/g3.json user.sub) sid=$(field /tmp/g3.json user.studentId)"

OWN=$(curl -s -H "Cookie: recall_user=$GC" "$B/api/auth/username?u=$GUSER")
say "G4 own name check -> $(printf '%s' "$OWN" | grep -o '"state":"[^"]*"') $(printf '%s' "$OWN" | grep -o '"own":[a-z]*')"

GC2=$(cookie "google:link-$R" alex@example.com "Alex Google" 1)
C5=$(curl -s -o /tmp/g5.json -w '%{http_code}' -H "Cookie: recall_user=$GC2" $B/api/me)
DECKS=$(curl -s -H "Cookie: recall_user=$GC2" $B/api/decks | grep -o '"id":"' | wc -l | tr -d ' ')
say "G5 google links to provider account -> $C5 sub=$(field /tmp/g5.json user.sub) role=$(field /tmp/g5.json capabilities.role) decks=$DECKS (want dev-user, admin, >0)"

GC3=$(cookie "google:clash-$R" stu28096@example.com "Clash" 1)
C6=$(curl -s -o /tmp/g6.json -w '%{http_code}' -H "Cookie: recall_user=$GC3" $B/api/me)
curl -s -o /tmp/g6r.json "$B/api/admin/users?q=stu28096%40example.com"
MATCH=$(node -e 'const j=JSON.parse(require("fs").readFileSync("/tmp/g6r.json","utf8")); console.log(j.users.length)')
say "G6 google on password email -> $C6 (want 401), roster matches=$MATCH (want 1), error=$(field /tmp/g6.json error 2>/dev/null)"

GC4=$(cookie "google:unv-$R" "unv$R@example.com" "Unverified" 0)
C7=$(curl -s -o /tmp/g7.json -w '%{http_code}' -H "Cookie: recall_user=$GC4" $B/api/me)
say "G7 unverified google -> $C7 sub=$(field /tmp/g7.json user.sub) needsUsername=$(field /tmp/g7.json user.needsUsername)"

START=$(curl -s -D - -o /dev/null "$B/auth/google/start?returnTo=/settings")
say "G8 start -> $(printf '%s' "$START" | head -1 | tr -d '\r') state-cookie=$(printf '%s' "$START" | grep -ci 'set-cookie: recall_oauth=') location-ok=$(printf '%s' "$START" | grep -c 'accounts.google.com/o/oauth2/v2/auth')"

CALLBACK=$(curl -s -D - -o /dev/null "$B/auth/google/callback?code=fake&state=fake")
say "G9 callback no state -> $(printf '%s' "$CALLBACK" | head -1 | tr -d '\r') -> $(printf '%s' "$CALLBACK" | grep -i '^location' | tr -d '\r')"
