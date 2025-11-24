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
  const servicePct = parseFloat(document.getElementById('servicePercentInput').value)/100;
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
  const resultEl = document.getElementById('calc-result');

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

      // comparison values
      const diff = grand_total - grand_total_100; // positive means current > 100% service
      const diffPct = (diff / (grand_total_100 || 1)) * 100;
        // Prepare three columns:
        // 1) combined: SERVIÇO + INFOPRODUTO + Total geral
        // 2) resumo: 100% SERVIÇO summary
        // 3) comparativo: difference between current and 100% serviço
        const combinedHtml = breakdownHtml; // left column

        const resumo100Html = `
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

        const comparativoHtml = `
          <div class="breakdown">
            <h3>Comparativo — seu cenário vs 100% SERVIÇO</h3>
            <div>Seu total: <strong>R$ ${fmt(grand_total)}</strong></div>
            <div>100% Serviço: <strong>R$ ${fmt(grand_total_100)}</strong></div>
            <div>Diferença: <strong>R$ ${fmt(diff)}</strong> (${diffPct.toFixed(2)}%)</div>
          </div>
        `;

        const breakdownEl = document.getElementById('calc-breakdown');
        if(breakdownEl){
          breakdownEl.innerHTML = `
            <div class="result-grid">
              <div class="result-col" id="result-combined">${combinedHtml}</div>
              <div class="result-col" id="result-100">${resumo100Html}</div>
              <div class="result-col" id="result-compare">${comparativoHtml}</div>
            </div>
          `;
        }
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
      const svcInput = document.getElementById('servicePercentInput');
      const iss = document.getElementById('iss');
  if(fatur) fatur.value = 50000;
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

  const svcLabel = document.getElementById('servicePctVal');
  const svcInput = document.getElementById('servicePercentInput');
  const svcSlider = document.getElementById('servicePercent');
  if(svcSlider){
    svcSlider.addEventListener('input', ()=>{
      const v = svcSlider.value;
      const svcInput = document.getElementById('servicePercentInput'); if(svcInput) svcInput.value = v;
      if(svcLabel) svcLabel.textContent = v;
      const comp = document.getElementById('complementPctVal'); if(comp) comp.textContent = String(100 - Number(v));
    });
  }

  if(svcInput){
    svcInput.addEventListener('input', ()=>{
      let v = parseInt(svcInput.value,10);
      if(Number.isNaN(v)) v = 0;
      if(v<0) v=0; if(v>100) v=100;
      svcInput.value = v;
      if(svcLabel) svcLabel.textContent = v;
      const comp = document.getElementById('complementPctVal'); if(comp) comp.textContent = String(100 - Number(v));
      const svcSlider2 = document.getElementById('servicePercent'); if(svcSlider2) svcSlider2.value = v;
    });
  }

  // --- Simples Nacional Logic (Anexo I & III) ---
  const anexoI = [
    {min:0, max:180000, aliquota:0.04, deduz:0.0},
    {min:180000.01, max:360000, aliquota:0.073, deduz:5940},
    {min:360000.01, max:720000, aliquota:0.095, deduz:13860},
    {min:720000.01, max:1800000, aliquota:0.107, deduz:22500},
    {min:1800000.01, max:3600000, aliquota:0.143, deduz:87300},
    {min:3600000.01, max:4800000, aliquota:0.19, deduz:378000}
  ];

  const anexoIII = [
    {min:0, max:180000, aliquota:0.06, deduz:0.0},
    {min:180000.01, max:360000, aliquota:0.112, deduz:9360},
    {min:360000.01, max:720000, aliquota:0.135, deduz:17640},
    {min:720000.01, max:1800000, aliquota:0.16, deduz:35640},
    {min:1800000.01, max:3600000, aliquota:0.21, deduz:125640},
    {min:3600000.01, max:4800000, aliquota:0.33, deduz:648000}
  ];

  // Sync sliders for Simples
  const svcSliderSimples = document.getElementById('servicePercentSimples');
  const svcInputSimples = document.getElementById('servicePercentInputSimples');
  const svcValLabel = document.getElementById('servicePctValSimples');
  const infoValLabel = document.getElementById('complementPctValSimples');

  function syncSimples(source) {
    let val = parseInt(source.value);
    if(isNaN(val)) val = 0;
    if(val < 0) val = 0; 
    if(val > 100) val = 100;

    // Update source to ensure validity
    source.value = val;

    // Sync pair
    if(source === svcSliderSimples && svcInputSimples) svcInputSimples.value = val;
    if(source === svcInputSimples && svcSliderSimples) svcSliderSimples.value = val;

    // Update Labels
    if(svcValLabel) svcValLabel.textContent = val;
    if(infoValLabel) infoValLabel.textContent = 100 - val;
  }

  if(svcSliderSimples) svcSliderSimples.addEventListener('input', () => syncSimples(svcSliderSimples));
  if(svcInputSimples) svcInputSimples.addEventListener('input', () => syncSimples(svcInputSimples));

  // Toggle "Meses de atividade" input visibility
  const less12Check = document.getElementById('less-12-months');
  const monthsGroup = document.getElementById('months-activity-group');
  if(less12Check && monthsGroup){
    less12Check.addEventListener('change', ()=>{
      if(less12Check.checked){
        monthsGroup.classList.remove('hidden');
      } else {
        monthsGroup.classList.add('hidden');
      }
    });
  }

  function performSimplesCalculation(){
    try {
      const faturamentoTotal = parseFloat(document.getElementById('faturamento-simples').value) || 0;
      let rbt12Input = document.getElementById('rbt12').value;
      let rbt12 = parseFloat(rbt12Input);
      
      const isLess12 = document.getElementById('less-12-months').checked;
      const monthsActivity = parseInt(document.getElementById('months-activity').value) || 1;

      // Get Split
      let servicePct = 100;
      if(svcSliderSimples) servicePct = parseFloat(svcSliderSimples.value);
      const infoPct = 100 - servicePct;

      const revenueService = faturamentoTotal * (servicePct / 100);
      const revenueInfo = faturamentoTotal * (infoPct / 100);

      // Logic for RBT12 determination
      if (isLess12) {
        if (monthsActivity === 1) {
          rbt12 = faturamentoTotal * 12;
        } else {
          let accumulated = rbt12; 
          if (isNaN(accumulated) || rbt12Input.trim() === '') {
             accumulated = 0; 
          }
          rbt12 = (accumulated / monthsActivity) * 12;
        }
      } else {
        if (isNaN(rbt12) || rbt12Input.trim() === '') {
          rbt12 = faturamentoTotal * 12;
        }
      }

      if (rbt12 > 4800000) {
        alert("A empresa será desenquadrada por ultrapassar o limite de faturamento Anual do Simples Nacional");
        const resultEl = document.getElementById('calc-result-simples');
        if(resultEl) resultEl.innerHTML = '';
        return;
      }

      // Calculate Effective Rate for Anexo III (Service)
      let bracketIII = anexoIII.find(b => rbt12 >= b.min && rbt12 <= b.max);
      if (!bracketIII) bracketIII = (rbt12 > 4800000) ? anexoIII[anexoIII.length - 1] : anexoIII[0];
      
      let effectiveRateIII = 0;
      if (rbt12 > 0) {
        effectiveRateIII = ((rbt12 * bracketIII.aliquota) - bracketIII.deduz) / rbt12;
      } else {
        effectiveRateIII = bracketIII.aliquota; 
      }
      const taxService = revenueService * effectiveRateIII;

      // Calculate Effective Rate for Anexo I (Infoproduto)
      let bracketI = anexoI.find(b => rbt12 >= b.min && rbt12 <= b.max);
      if (!bracketI) bracketI = (rbt12 > 4800000) ? anexoI[anexoI.length - 1] : anexoI[0];

      let effectiveRateI = 0;
      if (rbt12 > 0) {
        effectiveRateI = ((rbt12 * bracketI.aliquota) - bracketI.deduz) / rbt12;
      } else {
        effectiveRateI = bracketI.aliquota;
      }
      const taxInfo = revenueInfo * effectiveRateI;

      const totalTax = taxService + taxInfo;
      const totalEffectiveRate = (faturamentoTotal > 0) ? (totalTax / faturamentoTotal) : 0;

      // Scenario: 100% Service
      const taxServiceFull = faturamentoTotal * effectiveRateIII;
      const economy = taxServiceFull - totalTax;

      function fmt(v){ return Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }

      const resultEl = document.getElementById('calc-result-simples');
      if(resultEl){
        resultEl.innerHTML = `
          <div class="breakdown grand" style="text-align:center; max-width:100%; margin:0 auto;">
            <h3>Resultado Simples Nacional</h3>
            <div style="margin-bottom:16px; text-align:center;">
               <div style="margin:4px 0">Receita Bruta 12 meses (Base): <strong style="color:var(--white)">R$ ${fmt(rbt12)}</strong></div>
            </div>

            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:20px; margin-bottom:20px; text-align:left;">
              <!-- Anexo III (Service) -->
              <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:8px;">
                <h4 style="margin-top:0; color:var(--baby-blue)">Serviço (Anexo III)</h4>
                <div style="font-size:0.9em; margin-bottom:8px;">Faturamento: <strong>R$ ${fmt(revenueService)}</strong> (${servicePct.toFixed(0)}%)</div>
                <div style="margin:4px 0">Alíquota Nominal: <strong>${(bracketIII.aliquota * 100).toFixed(2)}%</strong></div>
                <div style="margin:4px 0">Parcela a Deduzir: <strong>R$ ${fmt(bracketIII.deduz)}</strong></div>
                <div style="margin:4px 0">Alíquota Efetiva: <strong>${(effectiveRateIII * 100).toFixed(2)}%</strong></div>
                <div style="margin-top:8px; border-top:1px solid rgba(255,255,255,0.2); padding-top:4px;">Imposto: <strong>R$ ${fmt(taxService)}</strong></div>
              </div>

              <!-- Anexo I (Infoproduto) -->
              <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:8px;">
                <h4 style="margin-top:0; color:var(--baby-blue)">Infoproduto (Anexo I)</h4>
                <div style="font-size:0.9em; margin-bottom:8px;">Faturamento: <strong>R$ ${fmt(revenueInfo)}</strong> (${infoPct.toFixed(0)}%)</div>
                <div style="margin:4px 0">Alíquota Nominal: <strong>${(bracketI.aliquota * 100).toFixed(2)}%</strong></div>
                <div style="margin:4px 0">Parcela a Deduzir: <strong>R$ ${fmt(bracketI.deduz)}</strong></div>
                <div style="margin:4px 0">Alíquota Efetiva: <strong>${(effectiveRateI * 100).toFixed(2)}%</strong></div>
                <div style="margin-top:8px; border-top:1px solid rgba(255,255,255,0.2); padding-top:4px;">Imposto: <strong>R$ ${fmt(taxInfo)}</strong></div>
              </div>

              <!-- Scenario 100% Service -->
              <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:8px; border:1px dashed rgba(255,255,255,0.3);">
                <h4 style="margin-top:0; color:#ffb7b7">Cenário: 100% Serviço</h4>
                <div style="font-size:0.9em; margin-bottom:8px; color:var(--gray-500)">Se todo faturamento fosse Anexo III</div>
                <div style="margin:4px 0">Alíquota Efetiva: <strong>${(effectiveRateIII * 100).toFixed(2)}%</strong></div>
                <div style="margin:4px 0">Imposto Total: <strong>R$ ${fmt(taxServiceFull)}</strong></div>
                <div style="margin-top:12px; border-top:1px solid rgba(255,255,255,0.2); padding-top:4px; color:var(--baby-blue)">
                   Economia Atual: <strong>R$ ${fmt(economy)}</strong>
                </div>
              </div>

              <div class="break-total" style="grid-column: 1 / -1; font-size:1.3em; border-top:1px solid rgba(255,255,255,0.2); padding-top:12px; color:var(--white); text-align:center;">
                <div>Total Imposto a Pagar: <strong>R$ ${fmt(totalTax)}</strong></div>
                <div style="font-size:0.7em; font-weight:normal; margin-top:5px;">Alíquota Efetiva Geral: <strong>${(totalEffectiveRate * 100).toFixed(2)}%</strong></div>
              </div>
            </div>
          </div>
        `;
      }

    } catch(e) {
      console.error(e);
    }
  }

  const btnSimples = document.getElementById('calc-run-simples');
  if(btnSimples) btnSimples.addEventListener('click', performSimplesCalculation);

  const btnResetSimples = document.getElementById('calc-reset-simples');
  if(btnResetSimples) btnResetSimples.addEventListener('click', ()=>{
    const fatInput = document.getElementById('faturamento-simples'); if(fatInput) fatInput.value = 50000;
    const rbtInput = document.getElementById('rbt12'); if(rbtInput) rbtInput.value = '';
    const less12 = document.getElementById('less-12-months'); if(less12) { less12.checked = false; less12.dispatchEvent(new Event('change')); }
    const months = document.getElementById('months-activity'); if(months) months.value = '';
    
    // Reset sliders
    if(svcSliderSimples) { svcSliderSimples.value = 100; syncSimples(svcSliderSimples); }

    const res = document.getElementById('calc-result-simples');
    if(res) res.innerHTML = '';
  });

  // --- PDF Export Logic ---
  const btnExportPdf = document.getElementById('btn-export-pdf');
  if(btnExportPdf) {
    btnExportPdf.addEventListener('click', () => {
      // Create a temporary container for the PDF content
      const reportContainer = document.createElement('div');
      reportContainer.style.width = '800px'; // Fixed width for A4 consistency
      reportContainer.style.padding = '40px';
      reportContainer.style.background = '#ffffff';
      reportContainer.style.color = '#000000';
      reportContainer.style.fontFamily = 'Arial, sans-serif';
      
      // Header
      const header = document.createElement('div');
      header.style.textAlign = 'center';
      header.style.marginBottom = '30px';
      header.innerHTML = `
        <img src="petroleo.svg" style="height: 60px; margin-bottom: 10px;">
        <h1 style="margin: 0; color: #0f1724; font-size: 24px;">Pronta+ Inteligência Empresarial</h1>
        <h2 style="margin: 5px 0 0; color: #4b5563; font-size: 18px;">Relatório de Planejamento Tributário</h2>
        <p style="color: #6b7280; font-size: 12px; margin-top: 5px;">Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin-top: 20px;">
      `;
      reportContainer.appendChild(header);

      // Content Wrapper
      const content = document.createElement('div');
      let hasContent = false;
      
      // Lucro Presumido
      const lpResult = document.getElementById('calc-result');
      // Check if we have the result grid (since table was removed)
      const lpGrid = lpResult ? lpResult.querySelector('.result-grid') : null;
      
      if(lpResult && lpGrid) {
        hasContent = true;
        const section = document.createElement('div');
        section.style.marginBottom = '30px';
        section.innerHTML = `<h3 style="color: #0f1724; border-bottom: 2px solid #bdefff; padding-bottom: 5px;">Lucro Presumido</h3>`;
        
        // Clone and style for PDF
        const clone = lpResult.cloneNode(true);
        
        // Remove table if it exists in clone (just in case)
        const table = clone.querySelector('table');
        if(table) table.remove();

        // Style Breakdown Grid
        const grid = clone.querySelector('.result-grid');
        if(grid) {
            grid.style.display = 'flex';
            grid.style.flexDirection = 'row';
            grid.style.flexWrap = 'wrap';
            grid.style.gap = '15px';
            grid.style.justifyContent = 'space-between';
        }

        // Style Breakdown Boxes
        const breakdowns = clone.querySelectorAll('.breakdown');
        breakdowns.forEach(box => {
            box.style.background = '#f9fafb';
            box.style.border = '1px solid #e5e7eb';
            box.style.padding = '15px';
            box.style.borderRadius = '8px';
            box.style.color = '#000';
            box.style.flex = '1 1 30%';
            box.style.minWidth = '200px';
            
            // Fix internal text colors
            const divs = box.querySelectorAll('div');
            divs.forEach(d => d.style.color = '#000');
            const h3 = box.querySelector('h3');
            if(h3) h3.style.color = '#000';
            const strongs = box.querySelectorAll('strong');
            strongs.forEach(s => s.style.color = '#000');
        });

        section.appendChild(clone);
        content.appendChild(section);
      }

      // Simples Nacional
      const snResult = document.getElementById('calc-result-simples');
      if(snResult && snResult.innerHTML.trim() !== '') {
        hasContent = true;
        const section = document.createElement('div');
        section.style.marginBottom = '30px';
        section.innerHTML = `<h3 style="color: #0f1724; border-bottom: 2px solid #bdefff; padding-bottom: 5px;">Simples Nacional</h3>`;
        
        const clone = snResult.cloneNode(true);
        
        // Force text color black
        const allElements = clone.getElementsByTagName('*');
        for(let el of allElements) {
            el.style.color = '#000000';
        }

        // Fix Grid Layout for PDF
        const grid = clone.querySelector('div[style*="display:grid"]');
        if(grid) {
            grid.style.display = 'flex';
            grid.style.flexDirection = 'row';
            grid.style.flexWrap = 'wrap';
            grid.style.gap = '15px';
            grid.style.justifyContent = 'space-between';
        }

        // Style the boxes (Service, Info, Scenario)
        const boxes = clone.querySelectorAll('div[style*="border-radius"]');
        boxes.forEach(box => {
            box.style.background = '#f9fafb';
            box.style.border = '1px solid #e5e7eb';
            box.style.marginBottom = '0';
            box.style.padding = '15px';
            box.style.flex = '1 1 30%'; // Try to fit 3 in a row
            box.style.minWidth = '200px';
            box.style.pageBreakInside = 'avoid';
        });

        // Fix titles inside boxes
        const boxTitles = clone.querySelectorAll('h4');
        boxTitles.forEach(t => t.style.color = '#000');

        section.appendChild(clone);
        content.appendChild(section);
      }

      if(!hasContent) {
        content.innerHTML = '<p style="text-align:center; color: #666; padding: 20px;">Nenhum cálculo realizado. Por favor, realize uma simulação antes de gerar o relatório.</p>';
      }

      reportContainer.appendChild(content);

      // Contact Section
      const contact = document.createElement('div');
      contact.style.marginTop = '30px';
      contact.style.padding = '20px';
      contact.style.background = '#f0f9ff';
      contact.style.border = '1px solid #bdefff';
      contact.style.borderRadius = '8px';
      contact.style.textAlign = 'center';
      contact.style.pageBreakInside = 'avoid';
      contact.innerHTML = `
        <h4 style="margin: 0 0 10px; color: #0f1724; font-size: 16px;">Dúvidas?</h4>
        <p style="margin: 0; color: #0f1724; font-size: 14px;">Se tiver mais dúvidas, chame o número <strong>+55 48 99632-5028</strong> no WhatsApp.</p>
      `;
      reportContainer.appendChild(contact);

      // Footer
      const footer = document.createElement('div');
      footer.style.marginTop = '20px';
      footer.style.textAlign = 'center';
      footer.style.fontSize = '10px';
      footer.style.color = '#9ca3af';
      footer.innerHTML = `
        <p>Pronta+ Inteligência Empresarial</p>
        <p>Este relatório é uma simulação e não substitui uma análise tributária oficial.</p>
      `;
      reportContainer.appendChild(footer);

      // Generate PDF
      const opt = {
        margin: 10,
        filename: 'Relatorio_Planejamento_Tributario_ProntaMais.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      html2pdf().set(opt).from(reportContainer).save();
    });
  }
});
