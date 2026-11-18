const socket = io();
const $ = id => document.getElementById(id);
let code='', host=false, avatarData='', currentURL='', ignoreSync=false, syncTimer, pendingJoin=null;
socket.on('connect',()=>{ $('syncstatus') && ($('syncstatus').textContent='● Conectado'); if(pendingJoin){socket.emit('join-room',pendingJoin);pendingJoin=null;} });
socket.on('connect_error',()=>{ if($('syncstatus')) $('syncstatus').textContent='Conectando ao servidor…'; });
$('avatar').addEventListener('change', e=>{
 const f=e.target.files[0]; if(!f)return;
 if(f.size>1.5*1024*1024){alert('Foto muito grande. Escolha uma de até 1,5 MB.');e.target.value='';return}
 const reader=new FileReader();reader.onload=()=>avatarData=reader.result;reader.readAsDataURL(f);
});
function enter(create){
 const name=$('name').value.trim(); if(!name){alert('Digite seu nome primeiro!');$('name').focus();return}
 let c=$('code').value.trim().toUpperCase();
 if(create&&!c){c=Math.random().toString(36).slice(2,8).toUpperCase();$('code').value=c;}
 if(!c){alert('Digite o código da sala.');return}
 pendingJoin={code:c,name,avatar:avatarData};
 $('create').disabled=true;$('join').disabled=true;$('create').textContent='Conectando…';
 if(socket.connected){socket.emit('join-room',pendingJoin);pendingJoin=null;}
 else socket.connect();
 setTimeout(()=>{if(pendingJoin){pendingJoin=null;$('create').disabled=false;$('join').disabled=false;$('create').textContent='＋ Criar sala';alert('Não consegui conectar ao servidor. Confira se o Render terminou o deploy e tente novamente.')}},15000);
}
$('create').onclick=()=>enter(true);$('join').onclick=()=>enter(false);
socket.on('error-msg',m=>{alert(m);$('create').disabled=false;$('join').disabled=false;$('create').textContent='＋ Criar sala';});
socket.on('joined',data=>{
 code=data.code;host=data.host;
 $('entry').classList.add('hidden');$('room').classList.remove('hidden');
 $('roomcode').textContent=code;$('role').textContent=host?'👑 Você é o anfitrião':'Você está assistindo';
 $('syncstatus').textContent='● Conectado';$('create').disabled=false;$('join').disabled=false;$('create').textContent='＋ Criar sala';
 if(data.state){setTimeout(()=>applySync(data.state),500)}
});
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(code);$('copy').textContent='Copiado!'}catch{prompt('Copie o código:',code)}};
$('leave').onclick=()=>location.reload();
socket.on('users',list=>{$('count').textContent=list.length;$('users').innerHTML=list.map(u=>`<span class="userchip">${u.host?'👑 ':''}${esc(u.name)}</span>`).join('')});
socket.on('chat',m=>{const el=document.createElement('div');el.className='message'+(m.system?' system':'');el.innerHTML=m.system?esc(m.text):`<strong>${esc(m.name)}:</strong> ${esc(m.text)}`;$('messages').append(el);$('messages').scrollTop=$('messages').scrollHeight});
$('chatform').onsubmit=e=>{e.preventDefault();const v=$('msg').value.trim();if(v){socket.emit('chat-message',v);$('msg').value=''}};
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
const video=$('video');
$('file').onchange=e=>{const f=e.target.files[0];if(!f)return;if(currentURL)URL.revokeObjectURL(currentURL);currentURL=URL.createObjectURL(f);video.src=currentURL;$('placeholder').style.display='none';video.load();};
function send(action){if(!host||ignoreSync)return;socket.emit('sync',{playing:!video.paused,time:video.currentTime,action})}
video.addEventListener('play',()=>send('play'));video.addEventListener('pause',()=>send('pause'));
video.addEventListener('seeked',()=>send('seek'));
video.addEventListener('timeupdate',()=>{if(host&&!video.paused){clearTimeout(syncTimer);syncTimer=setTimeout(()=>socket.emit('sync',{playing:true,time:video.currentTime,action:'tick'}),900)}});
function applySync(s){if(!video.src)return;ignoreSync=true;const target=Number(s.time)||0;if(Math.abs(video.currentTime-target)>1.5)video.currentTime=target;if(s.playing){video.play().catch(()=>{$('syncstatus').textContent='▶ Toque no vídeo para permitir reprodução'})}else video.pause();setTimeout(()=>ignoreSync=false,350)}
socket.on('sync',applySync);
socket.on('sync', s=>{if(!host) $('syncstatus').textContent=s.playing?'▶ Reproduzindo':'⏸ Pausado'});
