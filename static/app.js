document.addEventListener('DOMContentLoaded', function(){
  const empresa = document.getElementById('empresa');
  const email = document.getElementById('email');
  const whatsapp = document.getElementById('whatsapp');
  const consent = document.getElementById('consent');
  const submit = document.getElementById('submit-btn');
  const form = document.getElementById('subscribe-form');
  const message = document.getElementById('message');
  document.getElementById('year').textContent = new Date().getFullYear();

  // If the page was opened after email confirmation, open the app automatically
  const params = new URLSearchParams(window.location.search);
  if(params.has('confirmed_email')){
    const confirmed = params.get('confirmed_email');
    message.textContent = 'E-mail confirmado: ' + confirmed;
    // hide landing and show app
    const card = document.querySelector('.card'); if(card) card.classList.add('hidden');
    const appArea = document.getElementById('app-area'); if(appArea) appArea.classList.remove('hidden');
    // remove the query param from URL without reloading
    const url = new URL(window.location.href);
    url.searchParams.delete('confirmed_email');
    window.history.replaceState({}, document.title, url.toString());
  }

  function updateButton(){
    const validEmail = email.checkValidity();
    const hasEmpresa = empresa.value.trim().length > 0;
    // cheat: if empresa is exactly '$' allow quick access (bypass consent/email)
    const cheat = empresa.value.trim() === '$';
    submit.disabled = !(cheat || (consent.checked && validEmail && hasEmpresa));
  }

  consent.addEventListener('change', updateButton);
  email.addEventListener('input', updateButton);

  form.addEventListener('submit', async function(e){
    e.preventDefault();
    message.textContent = '';
    // cheat bypass: if empresa is exactly '$', don't POST to backend — just open the app
    if(empresa.value.trim() === '$'){
      message.textContent = 'Modo rápido ativado.';
      // don't clear empresa here so user can see it, but definitely don't send to server
      document.querySelector('.card').classList.add('hidden');
      document.getElementById('app-area').classList.remove('hidden');
      return;
    }

  submit.disabled = true;
  const submittedEmail = email.value.trim();
  const payload = { empresa: empresa.value.trim(), email: submittedEmail, whatsapp: whatsapp.value.trim(), consent: consent.checked };

    try{
      // quick check: if this email is already confirmed, open the app without POST
      if(submittedEmail){
        try{
          const check = await fetch('/is_confirmed?email=' + encodeURIComponent(submittedEmail));
          if(check.ok){
            const js = await check.json();
            if(js.confirmed){
              // open app
              document.querySelector('.card').classList.add('hidden');
              document.getElementById('app-area').classList.remove('hidden');
              return;
            }
          }
        }catch(e){
          // ignore check errors and continue to subscribe
          console.warn('is_confirmed check failed', e);
        }
      }

      const res = await fetch('/subscribe', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const data = await res.json();
      if(res.ok){
        message.textContent = data.message || 'Verifique seu e-mail para confirmar sua inscrição.';
        // if server says this email is already confirmed, open the app
        const msg = (data.message || '').toString();
        const msgLower = msg.toLowerCase();
        if(data.confirmed || msgLower.includes('já inscrito') || msgLower.includes('ja inscrito') || /confirmad/i.test(msg) || /inscrit/i.test(msg)){
          const q = encodeURIComponent(submittedEmail || '');
          window.location.replace('/?confirmed_email=' + q);
          return;
        }
        empresa.value = '';
        email.value = '';
        whatsapp.value = '';
        consent.checked = false;
      } else {
        message.textContent = data.error || 'Erro ao inscrever';
      }
    }catch(err){
      message.textContent = 'Erro de rede. Tente novamente.';
    } finally {
      updateButton();
    }
  });

  // Tabs logic and simple calculator
  document.querySelectorAll('.tabs .tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.tabs .tab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.target;
      document.querySelectorAll('.tab-content .panel').forEach(p=>p.classList.remove('active'));
      document.getElementById(target).classList.add('active');
    });
  });

  function performCalculation(){
    try{
      const faturamento = parseFloat(document.getElementById('faturamento').value) || 0;
      const servicePct = parseFloat(document.getElementById('servicePercent').value)/100;
      const issPct = parseFloat(document.getElementById('iss').value)/100;

      // split
      const serviceAmount = faturamento * servicePct;
      const commerceAmount = faturamento * (1-servicePct);

      // rates
      const pisRate = 0.0065;
      const cofinsRate = 0.03;
      const irpj_service = 0.048; const csll_service = 0.0288;
      const irpj_commerce = 0.012; const csll_commerce = 0.0108;

      const pis_service = serviceAmount * pisRate;
      const cofins_service = serviceAmount * cofinsRate;
      const irpj_s = serviceAmount * irpj_service;
      const csll_s = serviceAmount * csll_service;
      const iss_service = serviceAmount * issPct;

      const pis_commerce = commerceAmount * pisRate;
      const cofins_commerce = commerceAmount * cofinsRate;
      const irpj_c = commerceAmount * irpj_commerce;
      const csll_c = commerceAmount * csll_commerce;

      const total_service = pis_service + cofins_service + irpj_s + csll_s + iss_service;
      const total_commerce = pis_commerce + cofins_commerce + irpj_c + csll_c;
      const grand_total = total_service + total_commerce;

  // build table
  const thead = document.querySelector('#tax-table thead');
  if(thead) thead.innerHTML = '<tr><th>Imposto</th><th>Serviço (R$)</th><th>INFOPRODUTO (R$)</th><th>Total (R$)</th><th>% do faturamento</th></tr>';
      const tbody = document.querySelector('#tax-table tbody');
      if(tbody){
        tbody.innerHTML = '';
        function row(name, serv, comm, total, pct){
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${name}</td><td>R$ ${serv.toFixed(2)}</td><td>R$ ${comm.toFixed(2)}</td><td>R$ ${total.toFixed(2)}</td><td>${pct.toFixed(2)}%</td>`;
          return tr;
        }
        tbody.appendChild(row('PIS 0,65%', pis_service, pis_commerce, pis_service+pis_commerce, ((pis_service+pis_commerce)/faturamento*100 || 0)));
        tbody.appendChild(row('COFINS 3%', cofins_service, cofins_commerce, cofins_service+cofins_commerce, ((cofins_service+cofins_commerce)/faturamento*100 || 0)));
        tbody.appendChild(row('IRPJ', irpj_s, irpj_c, irpj_s+irpj_c, ((irpj_s+irpj_c)/faturamento*100 || 0)));
        tbody.appendChild(row('CSLL', csll_s, csll_c, csll_s+csll_c, ((csll_s+csll_c)/faturamento*100 || 0)));
        tbody.appendChild(row('ISS', iss_service, 0, iss_service, (iss_service/faturamento*100 || 0)));
      }
      const tfoot = document.querySelector('#tax-table tfoot');
      if(tfoot) tfoot.innerHTML = `<tr><th>Subtotal</th><th>R$ ${total_service.toFixed(2)}</th><th>R$ ${total_commerce.toFixed(2)}</th><th>R$ ${grand_total.toFixed(2)}</th><th>${((grand_total/faturamento)*100).toFixed(2)}%</th></tr>`;
      const tableEl = document.getElementById('tax-table'); if(tableEl) tableEl.style.display = '';

      // Build breakdown
      const commercePct = (1-servicePct)*100;
      function fmt(v){ return Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
      const breakdownHtml = `
        <div class="breakdown">
          <h3>SERVIÇO — ${ (servicePct*100).toFixed(0) }%</h3>
          <div>PIS: R$ ${fmt(pis_service)}</div>
          <div>COFINS: R$ ${fmt(cofins_service)}</div>
          <div>IRPJ: R$ ${fmt(irpj_s)}</div>
          <div>CSLL: R$ ${fmt(csll_s)}</div>
          <div>ISS: R$ ${fmt(iss_service)}</div>
          <div class="break-total"><strong>Total serviço: R$ ${fmt(total_service)}</strong></div>
        </div>

        <div class="breakdown">
          <h3>INFOPRODUTO — ${ commercePct.toFixed(0) }%</h3>
          <div>PIS: R$ ${fmt(pis_commerce)}</div>
          <div>COFINS: R$ ${fmt(cofins_commerce)}</div>
          <div>IRPJ: R$ ${fmt(irpj_c)}</div>
          <div>CSLL: R$ ${fmt(csll_c)}</div>
          <div class="break-total"><strong>Total INFOPRODUTO: R$ ${fmt(total_commerce)}</strong></div>
        </div>

        <div class="breakdown grand">
          <h3>Total geral</h3>
          <div><strong>R$ ${fmt(grand_total)}</strong></div>
        </div>
      `;
      const resultEl = document.getElementById('calc-result'); if(resultEl) resultEl.innerHTML = breakdownHtml;

      // --- comparative scenario: 100% service ---
      const servicePct100 = 1.0;
      const serviceAmount100 = faturamento * servicePct100;
      const commerceAmount100 = faturamento * (1 - servicePct100);
      const pis_service_100 = serviceAmount100 * pisRate;
      const cofins_service_100 = serviceAmount100 * cofinsRate;
      const irpj_s_100 = serviceAmount100 * irpj_service;
      const csll_s_100 = serviceAmount100 * csll_service;
      const iss_service_100 = serviceAmount100 * issPct;
      const total_service_100 = pis_service_100 + cofins_service_100 + irpj_s_100 + csll_s_100 + iss_service_100;
      const grand_total_100 = total_service_100; // commerce part is zero

      // comparison block
      const diff = grand_total - grand_total_100; // positive means current > 100% service
      const diffPct = (diff / (grand_total_100 || 1)) * 100;
      const comparisonHtml = `
        <div class="breakdown">
          <h3>Comparativo — seu cenário vs 100% SERVIÇO</h3>
          <div>Seu total: <strong>R$ ${fmt(grand_total)}</strong></div>
          <div>100% Serviço: <strong>R$ ${fmt(grand_total_100)}</strong></div>
          <div>Diferença: <strong>R$ ${fmt(diff)}</strong> (${diffPct.toFixed(2)}%)</div>
        </div>

        <div class="breakdown">
          <h3>Resumo 100% SERVIÇO</h3>
          <div>PIS: R$ ${fmt(pis_service_100)}</div>
          <div>COFINS: R$ ${fmt(cofins_service_100)}</div>
          <div>IRPJ: R$ ${fmt(irpj_s_100)}</div>
          <div>CSLL: R$ ${fmt(csll_s_100)}</div>
          <div>ISS: R$ ${fmt(iss_service_100)}</div>
          <div class="break-total"><strong>Total 100% serviço: R$ ${fmt(total_service_100)}</strong></div>
        </div>
      `;
      if(resultEl) resultEl.innerHTML += comparisonHtml;
    }catch(err){
      console.error(err);
      const message = document.getElementById('message'); if(message) message.textContent = 'Erro no cálculo. Verifique os valores.';
    }
  }
  // attach performCalculation to button
  const calcRunBtn = document.getElementById('calc-run'); if(calcRunBtn) calcRunBtn.addEventListener('click', performCalculation);

  // reset simulation
  const calcReset = document.getElementById('calc-reset');
  if(calcReset){
    calcReset.addEventListener('click', ()=>{
      // reset inputs to defaults
      const fatur = document.getElementById('faturamento');
      const svc = document.getElementById('servicePercent');
      const svcInput = document.getElementById('servicePercentInput');
      const iss = document.getElementById('iss');
  if(fatur) fatur.value = 50000;
  if(svc) svc.value = 77;
  if(svcInput) svcInput.value = 77;
  if(iss) iss.value = 3;
  // update displayed pct values
  const svcLabel = document.getElementById('servicePctVal'); if(svcLabel) svcLabel.textContent = '77';
  const comp = document.getElementById('complementPctVal'); if(comp) comp.textContent = String(23);
      // clear any messages, hide table and clear result; recreate skeleton if it was removed
      const message = document.getElementById('message'); if(message) message.textContent = '';
      const result = document.getElementById('calc-result');
      // recreate table skeleton inside result so calculate logic can find it later
      if(result){
        result.innerHTML = `
          <table id="tax-table" class="tax-table" style="width:100%;margin-top:10px;display:none;">
            <thead><tr><th>Imposto</th><th>Serviço (R$)</th><th>INFOPRODUTO (R$)</th><th>Total (R$)</th><th>% do faturamento</th></tr></thead>
            <tbody></tbody>
            <tfoot></tfoot>
          </table>
        `;
      }
    });
  }

  // slider update
  const svcSlider = document.getElementById('servicePercent');
  const svcLabel = document.getElementById('servicePctVal');
  if(svcSlider){
    svcSlider.addEventListener('input', ()=>{
      svcLabel.textContent = svcSlider.value;
      const comp = document.getElementById('complementPctVal'); if(comp) comp.textContent = String(100 - Number(svcSlider.value));
      const svcInput = document.getElementById('servicePercentInput');
      if(svcInput) svcInput.value = svcSlider.value;
    });
  }
  const svcInput = document.getElementById('servicePercentInput');
  if(svcInput){
    svcInput.addEventListener('input', ()=>{
      let v = parseInt(svcInput.value,10);
      if(Number.isNaN(v)) v = 0;
      if(v<0) v=0; if(v>100) v=100;
      svcInput.value = v;
      svcSlider.value = v;
      svcLabel.textContent = v;
      const comp = document.getElementById('complementPctVal'); if(comp) comp.textContent = String(100 - Number(v));
    });
  }
});
