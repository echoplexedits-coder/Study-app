B=http://localhost:3001
O='Origin: http://localhost:5173'
CT='content-type: application/json'
VER="$1"
R=$RANDOM
U="stu$R"; E="stu$R@example.com"; P1='BlueSky2026'; P2='NewHorizon2026'
K1=/tmp/p1c; K2=/tmp/p2c; rm -f $K1 $K2
# A fresh client IP per run: the durable limiter is per IP, and reusing one
# makes a second suite run hit the 10/hour registration ceiling.
IP="10.$((RANDOM%250)).$((RANDOM%250)).$((RANDOM%250))"
curl(){ command curl -H "cf-connecting-ip: $IP" "$@"; }
say(){ printf '%s\n' "$*"; }
PA(){ curl -s -o /tmp/b.json -w '%{http_code}' -b $K1 -c $K1 -H "$O" -H "$CT" -d "$2" "$B$1"; }
PUB(){ curl -s -o /tmp/b.json -w '%{http_code}' -H "$O" -H "$CT" -d "$2" "$B$1"; }

C=$(curl -s -o /tmp/reg.json -c $K1 -b $K1 -w '%{http_code}' -H "$O" -H "$CT" -d "{\"fullName\":\"Yash Qa\",\"username\":\"$U\",\"email\":\"$E\",\"password\":\"$P1\",\"confirmPassword\":\"$P1\"}" $B/api/auth/register)
SUB=$(grep -o '"sub":"[^"]*"' /tmp/reg.json | head -1 | cut -d'"' -f4)
say "A register -> $C sub=$SUB"
U2="stu${R}b"
say "B first rename -> $(PA /api/profile/username "{\"username\":\"$U2\"}") $(cat /tmp/b.json)"
say "C old name for others -> $(curl -s "$B/api/auth/username?u=$U" | grep -o '"state":"[^"]*"')"
say "D second rename -> $(PA /api/profile/username "{\"username\":\"stu${R}c\"}") $(head -c 60 /tmp/b.json)"
say "E consent -> $(PA /api/legal/consent "{\"version\":\"$VER\",\"terms\":true,\"privacy\":true,\"age\":true}") $(head -c 50 /tmp/b.json)"
say "F notes (student) -> $(curl -s -b $K1 -o /dev/null -w '%{http_code}' $B/api/notes)"
say "G legal status (student) -> $(curl -s -b $K1 -o /dev/null -w '%{http_code}' $B/api/legal/status)"
say "H admin GET as student -> $(curl -s -b $K1 -o /tmp/d.json -w '%{http_code}' $B/api/admin/users) $(grep -o '"error":"[^"]*"' /tmp/d.json)"
say "I admin POST as student -> $(PA /api/admin/users/$SUB/status '{"status":"suspended"}') $(grep -o '"error":"[^"]*"' /tmp/b.json)"

say "J reset request -> $(PUB /api/auth/password/request "{\"identifier\":\"$U2\"}") $(cat /tmp/b.json)"
ID=$(curl -s $B/api/admin/reset-requests | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
LINK=$(curl -s -H "$O" -H "$CT" -X POST $B/api/admin/reset-requests/$ID/link)
TOKEN=$(printf '%s' "$LINK" | sed -n 's/.*token=\([^"&]*\).*/\1/p')
say "K admin link -> $([ -n "$TOKEN" ] && echo minted || echo missing)"
say "L reset -> $(PUB /api/auth/password/reset "{\"token\":\"$TOKEN\",\"password\":\"$P2\",\"confirmPassword\":\"$P2\"}") $(head -c 30 /tmp/b.json)"
say "M token reuse -> $(PUB /api/auth/password/reset "{\"token\":\"$TOKEN\",\"password\":\"$P2\",\"confirmPassword\":\"$P2\"}") $(grep -o '"error":"[^"]*"' /tmp/b.json)"
say "N old password -> $(curl -s -o /dev/null -w '%{http_code}' -H "$O" -H "$CT" -d "{\"identifier\":\"$U2\",\"password\":\"$P1\"}" $B/api/auth/login)"
say "O new password -> $(curl -s -o /dev/null -c $K2 -w '%{http_code}' -H "$O" -H "$CT" -d "{\"identifier\":\"$U2\",\"password\":\"$P2\"}" $B/api/auth/login)"
say "P pre-reset session -> $(curl -s -o /dev/null -w '%{http_code}' -b $K1 $B/api/me)"

say "Q suspend -> $(curl -s -o /dev/null -w '%{http_code}' -H "$O" -H "$CT" -d '{"status":"suspended"}' $B/api/admin/users/$SUB/status)"
say "R suspended me -> $(curl -s -b $K2 -o /tmp/s2.json -w '%{http_code}' $B/api/me) $(grep -o '"error":"[^"]*"' /tmp/s2.json)"
say "S suspended login -> $(curl -s -o /tmp/s3.json -w '%{http_code}' -H "$O" -H "$CT" -d "{\"identifier\":\"$U2\",\"password\":\"$P2\"}" $B/api/auth/login) $(grep -o '"error":"[^"]*"' /tmp/s3.json)"
say "T restore -> $(curl -s -o /dev/null -w '%{http_code}' -H "$O" -H "$CT" -d '{"status":"active"}' $B/api/admin/users/$SUB/status)"
say "U login after restore -> $(curl -s -o /dev/null -c $K2 -w '%{http_code}' -H "$O" -H "$CT" -d "{\"identifier\":\"$U2\",\"password\":\"$P2\"}" $B/api/auth/login)"
say "V logout -> $(curl -s -o /dev/null -b $K2 -c $K2 -H "$O" -w '%{http_code}' -X POST $B/api/auth/logout)"
say "W roster counts -> $(curl -s $B/api/admin/users | grep -o '"counts":{[^}]*}')"
