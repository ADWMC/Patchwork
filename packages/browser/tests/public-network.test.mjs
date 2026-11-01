import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { createPublicNetwork } from '../src/browser/public-network.mjs'

const listen = server => new Promise(resolve => server.listen(0,'127.0.0.1',resolve))
function get(proxy,target,authenticated=true) {
  const location=new URL(proxy.server)
  return new Promise((resolve,reject)=>{
    const req=request({hostname:location.hostname,port:location.port,path:target,headers:authenticated?{'proxy-authorization':'Basic '+Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64')}:{}},res=>{let text='';res.on('data',data=>text+=data);res.on('end',()=>resolve({status:res.statusCode,text}))})
    req.on('error',reject);req.end()
  })
}
test('retrieval proxy pins validated DNS, requires credentials and closes all sockets',async()=>{
  const source=createServer((req,res)=>res.end(`source:${req.headers.host}:${req.url}`));await listen(source)
  const checked=[],errors=[]
  const network=await createPublicNetwork({authorizeTarget:async url=>{checked.push(url);return{addresses:[{address:'127.0.0.1',family:4}]}},onError:error=>errors.push(error)})
  try{
    const target=`http://does-not-resolve.invalid:${source.address().port}/rendered`
    network.allow(target)
    assert.equal((await get(network.proxy,target,false)).status,407)
    const result=await get(network.proxy,target)
    assert.equal(result.status,200);assert.equal(result.text,`source:does-not-resolve.invalid:${source.address().port}:/rendered`);assert.equal(checked.length,1);assert.deepEqual(errors,[])
  }finally{network.close();source.closeAllConnections();await new Promise(resolve=>source.close(resolve))}
})
test('retrieval proxy fails closed without a pinned address and on unsupported proxy protocols',async()=>{
  await assert.rejects(createPublicNetwork({proxy:{server:'socks5://127.0.0.1:1'}}),/HTTP\(S\)/)
  let reason
  const network=await createPublicNetwork({authorizeTarget:async()=>({}),onError:error=>reason=error.message})
  try{network.allow('http://example.invalid/');await assert.rejects(get(network.proxy,'http://example.invalid/'));assert.match(reason,/pinned address/)}finally{network.close()}
})
