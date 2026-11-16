/* ==========================================================================
   Body Scent - Shared Application Script (script.js)
   ========================================================================== */

const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwEcSaFUgdL5E_JmRE_lsd7NBe0dBRUBlIHc_Te4S7CYojxOcabL17sK56kT5LIKB9t/exec';

const GOOGLE_SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vR88_WmDYu6TjvKhtRast9VOnm_HaQpfI-ca1zrJn89oRHujidcRf0W3dNWFAXBY_SC30wEvOHFz54h/pub?gid=0&single=true&output=csv';

document.addEventListener('DOMContentLoaded', () => {
  // 1. หน้า product.html
  if (document.getElementById('product-list')) {
    initProductPage();
  }

  // 2. หน้า order.html
  if (document.getElementById('orderForm')) {
    initOrderPage();
  }

  // 3. หน้า admin.html
  if (document.querySelector('#ordersTable tbody')) {
    initAdminPage();
  }
});

/* ==========================================================================
   1. Product Catalog & Mood Filtering (product.html)
   ========================================================================== */

async function initProductPage() {
  const filterBar = document.getElementById('filter-bar');
  const productList = document.getElementById('product-list');

  const urlParams = new URLSearchParams(window.location.search);
  const initialMood = (urlParams.get('mood') || 'all').toLowerCase();

  let allProducts = [];

  const moods = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'fresh', label: 'Fresh' },
    { key: 'sweet', label: 'Sweet' },
    { key: 'confident', label: 'Confident' },
    { key: 'romance', label: 'Romance' }
  ];

  // สร้างปุ่มตัวกรองตาม mood
  if (filterBar) {
    filterBar.innerHTML = moods
      .map((m) => {
        const isActive = m.key === initialMood ? 'active' : '';
        const dotHtml =
          m.key !== 'all' ? `<span class="mood-dot dot-${m.key}"></span>` : '';
        return `
          <button type="button" class="filter-btn ${isActive}" data-mood="${m.key}">
            ${dotHtml}
            ${m.label}
          </button>
        `;
      })
      .join('');

    filterBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;

      const selectedMood = btn.dataset.mood;

      // อัปเดตสถานะ active ของปุ่ม
      filterBar
        .querySelectorAll('.filter-btn')
        .forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      // อัปเดต URL parameter โดยไม่รีโหลดหน้า
      const newUrl = new URL(window.location);
      if (selectedMood === 'all') {
        newUrl.searchParams.delete('mood');
      } else {
        newUrl.searchParams.set('mood', selectedMood);
      }
      window.history.replaceState({}, '', newUrl);

      renderProducts(selectedMood);
    });
  }

  // โหลดข้อมูลสินค้าจาก products.json
  try {
    const response = await fetch('products.json');
    if (!response.ok) throw new Error('ไม่สามารถโหลดไฟล์ products.json ได้');
    allProducts = await response.json();
    renderProducts(initialMood);
  } catch (error) {
    console.error(error);
    productList.innerHTML =
      '<p style="grid-column: 1 / -1; text-align: center; color: var(--text-muted);">ไม่สามารถโหลดรายการสินค้าได้ในขณะนี้</p>';
  }

  function renderProducts(moodFilter) {
    const filtered =
      moodFilter === 'all'
        ? allProducts
        : allProducts.filter((p) => p.mood.toLowerCase() === moodFilter);

    if (filtered.length === 0) {
      productList.innerHTML =
        '<p style="grid-column: 1 / -1; text-align: center; color: var(--text-muted);">ไม่พบสินค้าในหมวดหมู่นี้</p>';
      return;
    }

    productList.innerHTML = filtered
      .map((product) => {
        const itemLabel = `${product.name} (${product.size})`;
        const orderUrl = `order.html?item=${encodeURIComponent(itemLabel)}&price=${encodeURIComponent(product.price)}`;

        return `
          <article class="product-card mood-${escapeHtml(product.mood)}">
            <div class="product-image-wrap">
              <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" />
              <span class="product-size-tag">${escapeHtml(product.size)}</span>
            </div>
            <div class="product-body">
              <div class="mood-label">
                <span class="mood-dot"></span>
                <span>${escapeHtml(product.mood)}</span>
              </div>
              <h3 class="product-title">${escapeHtml(product.name)}</h3>
              <div class="mood-underline"></div>
              <p class="product-desc">${escapeHtml(product.description || '')}</p>
              <div class="product-footer">
                <div class="product-price">
                  ${Number(product.price).toLocaleString()} <span>บาท</span>
                </div>
                <a href="${orderUrl}" class="btn btn-sm">สั่งซื้อ</a>
              </div>
            </div>
          </article>
        `;
      })
      .join('');
  }
}

/* ==========================================================================
   2. Order Form Auto-fill & Google Apps Script Submission (order.html)
   ========================================================================== */

function initOrderPage() {
  const orderForm = document.getElementById('orderForm');
  const itemsInput = document.getElementById('items');
  const totalInput = document.getElementById('total');

  // อ่านค่า item และ price จาก URL parameter แล้วเติมลงฟอร์มทันที
  const urlParams = new URLSearchParams(window.location.search);
  const itemParam = urlParams.get('item');
  const priceParam = urlParams.get('price');

  if (itemParam && itemsInput) {
    itemsInput.value = itemParam;
  }

  if (priceParam && totalInput) {
    totalInput.value = priceParam;
  }

  // จัดการการส่งฟอร์มสั่งซื้อ
  orderForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const submitBtn = orderForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'กำลังบันทึกคำสั่งซื้อ...';
    }

    const payload = {
      customerName: document.getElementById('customerName').value.trim(),
      contact: document.getElementById('contact').value.trim(),
      items: document.getElementById('items').value.trim(),
      total: document.getElementById('total').value.trim(),
      note: document.getElementById('note').value.trim()
    };

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
      .then(() => {
        window.location.href = 'thankyou.html';
      })
      .catch((error) => {
        console.error(error);
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }
      });
  });
}

/* ==========================================================================
   3. Admin Orders Table & Custom CSV Parser (admin.html)
   ========================================================================== */

async function initAdminPage() {
  const tbody = document.querySelector('#ordersTable tbody');

  tbody.innerHTML =
    '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">กำลังโหลดข้อมูลคำสั่งซื้อ...</td></tr>';

  try {
    const response = await fetch(GOOGLE_SHEET_CSV_URL);
    if (!response.ok) throw new Error('ไม่สามารถดึงข้อมูล CSV จาก Google Sheets ได้');

    const csvText = await response.text();
    const rows = parseCSV(csvText);

    // ตัดแถวหัวตาราง (index 0) และกรองแถวว่างออก
    const dataRows = rows
      .slice(1)
      .filter((row) => row.some((cell) => cell && cell.trim() !== ''));

    if (dataRows.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">ยังไม่มีรายการคำสั่งซื้อ</td></tr>';
      return;
    }

    // เรียงจากรายการล่าสุดขึ้นก่อน
    const latestFirstRows = dataRows.reverse();

    tbody.innerHTML = latestFirstRows
      .map((row) => {
        const timestamp = row[0] || '-';
        const customerName = row[1] || '-';
        const contact = row[2] || '-';
        const items = row[3] || '-';
        const total = row[4] || '-';
        const note = row[5] || '-';

        return `
          <tr>
            <td>${escapeHtml(timestamp)}</td>
            <td>${escapeHtml(customerName)}</td>
            <td>${escapeHtml(contact)}</td>
            <td>${escapeHtml(items)}</td>
            <td>${escapeHtml(total)}</td>
            <td>${escapeHtml(note)}</td>
          </tr>
        `;
      })
      .join('');
  } catch (error) {
    console.error(error);
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--mood-romance);">เกิดข้อผิดพลาดในการโหลดข้อมูลคำสั่งซื้อ</td></tr>';
  }
}

/**
 * ฟังก์ชัน Parse CSV แบบเขียนเอง (รองรับข้อความที่มีเครื่องหมายจุลภาค , ขึ้นบรรทัดใหม่ และเครื่องหมายคำพูด "")
 */
function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (insideQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // ข้ามเครื่องหมาย " ตัวถัดไป (escaped quote)
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r' && nextChar === '\n') {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++; // ข้าม \n
      } else if (char === '\n' || char === '\r') {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  // เก็บฟิลด์และแถวสุดท้ายหากไม่ได้ลงท้ายด้วยขึ้นบรรทัดใหม่
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows;
}

/**
 * ป้องกัน XSS เมื่อนำข้อความมาแสดงผลใน HTML
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}