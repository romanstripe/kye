python3 - <<'PY'
top=open('top13.html').read(); data=open('data13.js').read(); main=open('main13.js').read().replace('/*SOL*/',open('sol.js').read())+'\n'+open('onb.js').read()
s=top+data+'\n'+main+'</script>\n'
open('ring13.html','w').write(s)
open('local13.html','w').write(s.replace('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js','../vid/package/build/three.min.js'))
PY
