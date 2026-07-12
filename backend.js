/* Backend Myown — Supabase + Row Level Security. La clé ci-dessous est publique par conception. */
const SUPABASE_URL='https://wleqiweekvpdrymgduov.supabase.co';
const SUPABASE_KEY='sb_publishable_thCOi6x8D3_wSTSsW0JkGA_0nqe9nbD';
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
let collocApp=null,space=null,sessionUser=null;

const ts=x=>x?new Date(x).getTime():Date.now();
const err=e=>{console.error(e);toast(e?.message||'Une erreur est survenue.');};
async function q(table,query){const r=await query;if(r.error)throw r.error;return r.data||[]}
async function hydrate(){
  const {data:{session}}=await sb.auth.getSession(); sessionUser=session?.user||null;
  db=structuredClone(seed); db.current=sessionUser?.id||null; db.users=[];db.requests=[];db.members=[];db.tasks=[];db.shopping=[];db.expenses=[];db.journal=[];db.history=[];
  if(!sessionUser){render();return}
  try{
    await sb.from('profiles').update({email:sessionUser.email}).eq('id',sessionUser.id).then(()=>{},()=>{});
    const profiles=await q('profiles',sb.from('profiles').select('*').order('created_at'));
    db.users=profiles.map(p=>({id:p.id,email:p.email||p.email_address||(p.id===sessionUser.id?sessionUser.email:''),pseudo:p.pseudo||'Utilisateur',avatar:p.avatar_url||'🙂',siteRole:p.site_role||'user',created:ts(p.created_at)}));
    if(!isAdmin())db.users=db.users.map(u=>u.id===sessionUser.id?u:{...u,email:''});
    const apps=await q('applications',sb.from('applications').select('*').eq('slug','colloc').limit(1)); collocApp=apps[0];
    if(!collocApp){render();return}
    const [reqs,members,spaces]=await Promise.all([
      q('access_requests',sb.from('access_requests').select('*').eq('app_id',collocApp.id).order('created_at',{ascending:false})),
      q('app_members',sb.from('app_members').select('*').eq('app_id',collocApp.id)),
      q('colloc_spaces',sb.from('colloc_spaces').select('*').eq('app_id',collocApp.id).limit(1))
    ]);
    db.requests=reqs.map(r=>({id:r.id,userId:r.user_id,message:r.message,status:r.status,created:ts(r.created_at),decided:ts(r.decided_at)}));
    db.members=members.map(m=>m.user_id); space=spaces[0]||null;
    if(space){db.settings={...db.settings,name:space.name||db.settings.name,description:space.description||db.settings.description,currency:space.currency||'EUR',requestsOpen:space.requests_open!==false,requireMessage:space.require_message!==false,historyRetention:space.history_retention||'forever'};}
    if(space&&isMember()){
      const [tasks,shop,expenses,journal,history]=await Promise.all([
        q('tasks',sb.from('tasks').select('*').eq('space_id',space.id).order('created_at',{ascending:false})),
        q('shopping_items',sb.from('shopping_items').select('*').eq('space_id',space.id).order('created_at',{ascending:false})),
        q('expenses',sb.from('expenses').select('*').eq('space_id',space.id).order('expense_date',{ascending:false})),
        q('journal_entries',sb.from('journal_entries').select('*').eq('space_id',space.id).order('created_at',{ascending:false})),
        q('activity_history',sb.from('activity_history').select('*').eq('space_id',space.id).order('created_at',{ascending:false}).limit(300))
      ]);
      db.tasks=tasks.map(x=>({id:x.id,title:x.title,assignee:x.assignee_id,done:x.done,due:x.due_label||'Sans échéance',points:x.points||1}));
      db.shopping=shop.map(x=>({id:x.id,title:x.title,by:x.added_by,done:x.done}));
      db.expenses=expenses.map(x=>({id:x.id,title:x.title,amount:Number(x.amount),by:x.paid_by,date:x.expense_date}));
      db.journal=journal.map(x=>({id:x.id,title:x.title,body:x.body,by:x.author_id,date:ts(x.created_at)}));
      db.history=history.map(x=>({id:x.id,actor:x.actor_id,action:x.action,date:ts(x.created_at)}));
    }
  }catch(e){err(e)} render();
}

modalHtml=function(){
  if(!modal)return '';
  if(modal==='auth')return `<div class="modal-wrap"><form class="modal form" onsubmit="login(event)"><div class="modal-head"><div><span class="eyebrow">Connexion sécurisée</span><h2>Se connecter</h2></div><button type="button" class="close" onclick="closeModal()">×</button></div><div class="field"><label>E-mail</label><input name="email" type="email" autocomplete="email" required></div><div class="field"><label>Mot de passe</label><input name="password" type="password" autocomplete="current-password" minlength="8" required></div><button class="btn">Se connecter</button><button type="button" class="btn soft" onclick="modal='signup';render()">Créer un compte Myown</button></form></div>`;
  if(modal==='signup')return `<div class="modal-wrap"><form class="modal form" onsubmit="signup(event)"><div class="modal-head"><div><span class="eyebrow">Compte Myown</span><h2>Créer mon profil</h2></div><button type="button" class="close" onclick="closeModal()">×</button></div><div class="field"><label>Pseudo</label><input name="pseudo" required maxlength="30"></div><div class="field"><label>E-mail</label><input name="email" type="email" autocomplete="email" required></div><div class="field"><label>Mot de passe</label><input name="password" type="password" autocomplete="new-password" minlength="8" required></div><div class="field"><label>Avatar</label><input name="avatar" value="🙂">${avatarHelp()}</div><button class="btn">Créer le compte</button></form></div>`;
  if(modal==='request')return `<div class="modal-wrap"><form class="modal form" onsubmit="sendRequest(event)"><div class="modal-head"><h2>Demander l’accès à Colloc</h2><button type="button" class="close" onclick="closeModal()">×</button></div><p>Ta demande sera examinée par l’administrateur technique du site.</p><div class="field"><label>Message de présentation</label><textarea name="message" required maxlength="800" placeholder="Explique brièvement qui tu es…"></textarea></div><button class="btn">Envoyer ma demande</button></form></div>`;
  return addModal();
};
render=function(){let body=route==='home'?home():route==='apps'?apps():route==='colloc'?colloc():route==='admin'?admin():route==='profile'?profile():home();document.querySelector('#app').innerHTML=`<div class="shell">${topbar()}${body}${modalHtml()}</div>`};

login=async function(e){e.preventDefault();const f=new FormData(e.target);const {error}=await sb.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error)return err(error);modal=null;await hydrate();toast('Connecté !')};
signup=async function(e){e.preventDefault();const f=new FormData(e.target);let av;try{av=await validateAvatarValue(f.get('avatar'))}catch(x){return toast(x.message)}const {data,error}=await sb.auth.signUp({email:f.get('email'),password:f.get('password'),options:{emailRedirectTo:'https://ratawax.github.io/Myown/',data:{pseudo:f.get('pseudo'),avatar_url:av,email:f.get('email')}}});if(error)return err(error);modal=null;if(!data.session){render();toast('Compte créé : vérifie ton e-mail pour confirmer.');}else{await sb.from('profiles').update({email:f.get('email'),avatar_url:av,pseudo:f.get('pseudo')}).eq('id',data.session.user.id).then(()=>{},()=>{});await hydrate();toast('Compte créé.')}};
logout=async function(){await sb.auth.signOut();sessionUser=null;db.current=null;go('home');await hydrate()};
sendRequest=async function(e){e.preventDefault();try{await q('access_requests',sb.from('access_requests').insert({app_id:collocApp.id,user_id:db.current,message:new FormData(e.target).get('message')}));modal=null;await hydrate();toast('Demande envoyée à l’admin.')}catch(x){err(x)}};
decide=async function(id,status){try{const req=db.requests.find(r=>r.id===id);if(!req)throw new Error('Demande introuvable.');const rpc=await sb.rpc('review_access_request',{request_id:id,new_status:status,decision_note:null});if(rpc.error){const missing=/review_access_request|schema cache|Could not find the function/i.test(rpc.error.message||'');if(!missing)throw rpc.error;await q('access_requests',sb.from('access_requests').update({status,decided_at:new Date().toISOString()}).eq('id',id));if(status==='accepted'){const existing=await sb.from('app_members').select('app_id').eq('app_id',collocApp.id).eq('user_id',req.userId).maybeSingle();if(existing.error&&existing.error.code!=='PGRST116')throw existing.error;if(!existing.data)await q('app_members',sb.from('app_members').insert({app_id:collocApp.id,user_id:req.userId,role:'member'}));}}await hydrate();toast('Décision enregistrée.')}catch(e){err(e)}};
addItem=async function(e,t){e.preventDefault();const f=new FormData(e.target);try{let table,row;if(t==='task'){table='tasks';row={space_id:space.id,title:f.get('title'),assignee_id:f.get('assignee')||null,due_label:f.get('due'),points:1}}if(t==='shopping'){table='shopping_items';row={space_id:space.id,title:f.get('title'),added_by:db.current}}if(t==='expense'){table='expenses';row={space_id:space.id,title:f.get('title'),amount:+f.get('amount'),paid_by:db.current,expense_date:new Date().toISOString().slice(0,10)}}if(t==='journal'){table='journal_entries';row={space_id:space.id,title:f.get('title'),body:f.get('body'),author_id:db.current}}await q(table,sb.from(table).insert(row));modal=null;await hydrate();toast('Ajout partagé enregistré.')}catch(x){err(x)}};
toggle=async function(t,id){try{const table=t==='task'?'tasks':'shopping_items',key=t==='task'?'tasks':'shopping',item=db[key].find(x=>x.id===id);await q(table,sb.from(table).update({done:!item.done}).eq('id',id));await hydrate()}catch(x){err(x)}};
saveProfile=async function(e){e.preventDefault();const f=new FormData(e.target);try{const av=await validateAvatarValue(f.get('avatar'));await sb.from('profiles').update({email:sessionUser?.email}).eq('id',db.current).then(()=>{},()=>{});await q('profiles',sb.from('profiles').update({pseudo:f.get('pseudo'),avatar_url:av}).eq('id',db.current));await hydrate();toast('Profil mis à jour.')}catch(x){err(x)}};
saveSettings=async function(e){e.preventDefault();const f=new FormData(e.target);try{await q('colloc_spaces',sb.from('colloc_spaces').update({name:f.get('name'),description:f.get('description'),currency:f.get('currency'),history_retention:f.get('historyRetention'),requests_open:f.has('requestsOpen'),require_message:f.has('requireMessage')}).eq('id',space.id));await hydrate();toast('Réglages enregistrés.')}catch(x){err(x)}};
resetDemo=function(){toast('Les données réelles ne se réinitialisent pas depuis le navigateur.')};
sb.auth.onAuthStateChange(()=>setTimeout(hydrate,0)); hydrate();
