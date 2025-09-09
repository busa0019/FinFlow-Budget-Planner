// ===== Constants & Initialization =====
        const PASSWORD = "1234567890";
        const STORAGE_KEY = 'finflowData';
        let data = {
            user: { name: '', bank: '', currency: 'CAD', balance: 0, savings: 0 },
            income: [],
            expenses: [],
            owing: [],
            upcoming: [],
            goals: [],
            history: []
        };
        let chart = null;
        let monthlyChart = null;
        const currencySymbols = {
            'CAD': 'CA$',
            'USD': '$',
            'EUR': '€',
            'GBP': '£',
            'INR': '₹',
            'NGN': '₦'
        };
        const currentDate = new Date('2025-09-09'); // Fixed date
        const currentMonth = currentDate.toISOString().split('-').slice(0, 2).join('-');

        // Load data from localStorage
        function loadData() {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                data = { ...data, ...JSON.parse(saved) };
            }
            updateDisplay();
            initializeChart();
            generateReports();
        }

        // Save data to localStorage
        function saveData() {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }

        // Format currency
        function formatCurrency(amount) {
            const currency = data.user.currency;
            const symbol = currencySymbols[currency] || currency || 'CA$';
            const formatted = new Intl.NumberFormat('en-US', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            }).format(amount);
            return symbol + formatted;
        }

        // Update dashboard displays
        function updateDisplay() {
            const userName = data.user.name ? `Welcome, ${data.user.name}! Your Financial Journey Awaits!` : 'Your Smart Budget Companion';
            document.getElementById('userNameDisplay').innerHTML = userName;
            document.getElementById('displayBank').textContent = data.user.bank || '-';
            document.getElementById('displayCurrency').textContent = data.user.currency || '-';

            const balance = data.user.balance;
            const savings = data.user.savings;
            const totalIncome = data.income.reduce((sum, i) => sum + i.amount, 0);
            const totalExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);
            const owedToMe = data.owing.filter(o => o.type === 'they-owe-me').reduce((sum, o) => sum + o.amount, 0);
            const iOwe = data.owing.filter(o => o.type === 'i-owe').reduce((sum, o) => sum + o.amount, 0);
            const upcomingTotal = data.upcoming.reduce((sum, u) => sum + u.amount, 0);
            const net = balance + savings + owedToMe - iOwe - upcomingTotal + totalIncome - totalExpenses;

            document.getElementById('displayBalance').innerHTML = formatCurrency(balance);
            document.getElementById('displaySavings').innerHTML = formatCurrency(savings);
            document.getElementById('displayOwingMe').innerHTML = formatCurrency(owedToMe);
            document.getElementById('displayOwingOthers').innerHTML = formatCurrency(iOwe);
            document.getElementById('displayUpcomingTotal').innerHTML = formatCurrency(upcomingTotal);
            document.getElementById('displayNet').innerHTML = formatCurrency(net);
            document.getElementById('displayTotalIncome').innerHTML = formatCurrency(totalIncome);
            document.getElementById('displayTotalExpenses').innerHTML = formatCurrency(totalExpenses);

            // Budget progress
            const budgetPercent = totalIncome > 0 ? (totalExpenses / totalIncome * 100) : 0;
            document.getElementById('budgetProgress').style.width = `${Math.min(budgetPercent, 100)}%`;
            document.getElementById('budgetText').textContent = `${budgetPercent.toFixed(1)}% used (Income: ${formatCurrency(totalIncome)} | Expenses: ${formatCurrency(totalExpenses)})`;

            renderLists();
            updateChart();
            renderGoals();
            generateReports();
        }

        // Get monthly totals
        function getMonthlyIncome() {
            return data.income.filter(i => i.date.startsWith(currentMonth)).reduce((sum, i) => sum + i.amount, 0);
        }

        function getMonthlyExpenses() {
            return data.expenses.filter(e => e.date.startsWith(currentMonth)).reduce((sum, e) => sum + e.amount, 0);
        }

        function getMonthlyNet() {
            return getMonthlyIncome() - getMonthlyExpenses();
        }

        // Render dynamic lists
        function renderLists() {
            ['income', 'expenses', 'owing', 'upcoming'].forEach(type => {
                const list = document.getElementById(`${type}List`);
                list.innerHTML = '';
                data[type].forEach(item => {
                    const li = document.createElement('li');
                    let content = `<span>${item.desc || item.name} ${item.category ? `<span class="category-tag">${item.category}</span>` : ''} - ${formatCurrency(item.amount)}</span>`;
                    if (type === 'upcoming' && item.date) content += ` <small>Due: ${new Date(item.date).toLocaleDateString()}</small>`;
                    if (type === 'owing') content = `<span>${item.name} - ${formatCurrency(item.amount)} (${item.type === 'they-owe-me' ? '+' : '-'})</span>`;
                    content += `<button class="removeBtn" data-type="${type}" data-id="${item.id}"><i class="fas fa-times"></i> Remove</button>`;
                    li.innerHTML = content;
                    list.appendChild(li);
                });
            });
            renderGoals();
        }

        // Render Goals
        function renderGoals() {
            const goalsList = document.getElementById('goalsList');
            goalsList.innerHTML = '';
            data.goals.forEach(goal => {
                const li = document.createElement('li');
                const progress = goal.target > 0 ? (goal.current / goal.target * 100) : 0;
                const content = `
                    <div style="flex: 1;">
                        <strong>${goal.desc}</strong><br>
                        Current: ${formatCurrency(goal.current)} / Target: ${formatCurrency(goal.target)}
                        <div class="goal-progress">
                            <div class="goal-fill" style="width: ${progress}%"></div>
                        </div>
                        <small>${progress.toFixed(1)}% Complete</small>
                    </div>
                    <button class="removeBtn" data-type="goals" data-id="${goal.id}"><i class="fas fa-times"></i> Remove</button>
                `;
                li.innerHTML = content;
                goalsList.appendChild(li);
            });
        }

        // Event delegation for remove buttons
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.removeBtn');
            if (btn) {
                e.stopPropagation();
                const type = btn.dataset.type;
                const id = parseInt(btn.dataset.id);
                if (data[type]) {
                    data[type] = data[type].filter(item => item.id !== id);
                    if (type === 'income' || type === 'expenses') {
                        data.history = data.history.filter(h => h.id !== id);
                    }
                    saveData();
                    updateDisplay();
                }
            }
        });

        // Initialize pie chart for expenses
        function initializeChart() {
            const ctx = document.getElementById('expenseChart').getContext('2d');
            if (chart) chart.destroy();
            chart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: ['Food', 'Rent', 'Transport', 'Entertainment', 'Other'],
                    datasets: [{
                        data: [0, 0, 0, 0, 0],
                        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
                }
            });
            updateChart();
        }

        function updateChart() {
            if (!chart) return;
            const categories = {};
            data.expenses.forEach(exp => {
                const cat = exp.category || 'Other';
                categories[cat] = (categories[cat] || 0) + exp.amount;
            });
            chart.data.labels = Object.keys(categories);
            chart.data.datasets[0].data = Object.values(categories);
            chart.update();
        }

        // Generate Reports
        function generateReports() {
            const monthlyIncome = getMonthlyIncome();
            const monthlyExpenses = getMonthlyExpenses();
            const net = getMonthlyNet();
            document.getElementById('monthlySummary').textContent = `September 2025: Income ${formatCurrency(monthlyIncome)} | Expenses ${formatCurrency(monthlyExpenses)} | Net ${formatCurrency(net)}`;

            // Simple category report
            const reportBody = document.getElementById('reportTableBody');
            reportBody.innerHTML = '';
            const categories = {};
            data.expenses.filter(e => e.date.startsWith(currentMonth)).forEach(exp => {
                const cat = exp.category || 'Other';
                categories[cat] = (categories[cat] || 0) + exp.amount;
            });
            Object.entries(categories).forEach(([cat, amt]) => {
                const row = `<tr><td>${cat}</td><td>${formatCurrency(0)}</td><td>${formatCurrency(amt)}</td><td>${formatCurrency(-amt)}</td></tr>`;
                reportBody.innerHTML += row;
            });

            // Monthly line chart
            const monthlyCtx = document.getElementById('monthlyChart')?.getContext('2d');
            if (monthlyCtx) {
                if (monthlyChart) monthlyChart.destroy();
                monthlyChart = new Chart(monthlyCtx, {
                    type: 'line',
                    data: {
                        labels: ['Income', 'Expenses'],
                        datasets: [{
                            label: 'Amount',
                            data: [monthlyIncome, monthlyExpenses],
                            borderColor: 'var(--primary)',
                            backgroundColor: 'rgba(67, 97, 238, 0.2)',
                            tension: 0.1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'top' } }
                    }
                });
            }
        }

        // ===== Event Listeners =====

        // Password Protection
        const passwordOverlay = document.getElementById('passwordOverlay');
        const sitePassword = document.getElementById('sitePassword');
        const submitPassword = document.getElementById('submitPassword');
        const passwordError = document.getElementById('passwordError');

        submitPassword.addEventListener('click', () => {
            if (sitePassword.value === PASSWORD) {
                passwordOverlay.style.display = 'none';
                loadData();
            } else {
                passwordError.style.display = 'block';
                sitePassword.value = '';
                setTimeout(() => passwordError.style.display = 'none', 3000);
            }
        });

        sitePassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submitPassword.click();
        });

        // Theme Toggle
        const themeToggle = document.getElementById('themeToggle');
        themeToggle.addEventListener('click', () => {
            const body = document.body;
            const currentTheme = body.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            body.setAttribute('data-theme', newTheme);
            themeToggle.querySelector('i').className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
            localStorage.setItem('theme', newTheme);
        });

        // Load saved theme
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.body.setAttribute('data-theme', savedTheme);
        themeToggle.querySelector('i').className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';

        // Toggle Sections
        document.querySelectorAll('.section-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const content = toggle.parentElement.querySelector('.section-content');
                const icon = toggle.querySelector('i:last-child');
                
                content.classList.toggle('expanded');
                icon.classList.toggle('fa-chevron-down');
                icon.classList.toggle('fa-chevron-right');
            });
        });

        // Account Setup Form
        document.getElementById('setupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const bankSelect = document.getElementById('bankSelect');
            const currencySelect = document.getElementById('currencySelect');
            data.user.name = document.getElementById('userName').value;
            data.user.bank = bankSelect.value === 'Other' ? document.getElementById('bankOtherText').value : bankSelect.value;
            data.user.currency = currencySelect.value === 'Other' ? 'USD' : currencySelect.value;
            data.user.balance = parseFloat(document.getElementById('startingBalance').value) || 0;
            data.user.savings = parseFloat(document.getElementById('startingSavings').value) || 0;
            saveData();
            updateDisplay();
            alert('Account setup saved! Dashboard updated with new settings.');
        });

        // Bank Other Toggle
        document.getElementById('bankSelect').addEventListener('change', (e) => {
            const otherLabel = document.getElementById('bankOtherLabel');
            otherLabel.style.display = e.target.value === 'Other' ? 'block' : 'none';
        });

        // Add Income
        document.getElementById('addIncomeBtn').addEventListener('click', () => {
            const desc = document.getElementById('incomeDesc').value.trim();
            const amount = parseFloat(document.getElementById('incomeAmount').value);
            if (desc && amount > 0) {
                const newId = Date.now();
                data.income.push({ id: newId, desc, amount, date: currentMonth + '-' + new Date().getDate().toString().padStart(2, '0') });
                data.history.push({ id: newId, type: 'income', desc, amount, date: data.income[data.income.length - 1].date });
                document.getElementById('incomeDesc').value = '';
                document.getElementById('incomeAmount').value = '';
                saveData();
                updateDisplay();
            } else {
                alert('Please enter a valid description and amount.');
            }
        });

        // Add Expense
        document.getElementById('addExpenseBtn').addEventListener('click', () => {
            const desc = document.getElementById('expenseDesc').value.trim();
            const category = document.getElementById('expenseCategory').value.trim() || 'Other';
            const amount = parseFloat(document.getElementById('expenseAmount').value);
            if (desc && amount > 0) {
                const newId = Date.now();
                data.expenses.push({ id: newId, desc, category, amount, date: currentMonth + '-' + new Date().getDate().toString().padStart(2, '0') });
                data.history.push({ id: newId, type: 'expense', desc, category, amount, date: data.expenses[data.expenses.length - 1].date });
                document.getElementById('expenseDesc').value = '';
                document.getElementById('expenseCategory').value = '';
                document.getElementById('expenseAmount').value = '';
                saveData();
                updateDisplay();
            } else {
                alert('Please enter a valid description and amount.');
            }
        });

        // Add Owing
        document.getElementById('addOwingBtn').addEventListener('click', () => {
            const name = document.getElementById('owingName').value.trim();
            const amount = parseFloat(document.getElementById('owingAmount').value);
            const type = document.getElementById('owingType').value;
            if (name && amount > 0 && type) {
                const newId = Date.now();
                data.owing.push({ id: newId, name, amount, type, date: currentMonth + '-' + new Date().getDate().toString().padStart(2, '0') });
                data.history.push({ 
                    id: newId,
                    type: type === 'they-owe-me' ? 'income' : 'expense', 
                    desc: `${type === 'they-owe-me' ? 'Owed by' : 'Owe to'} ${name}`, 
                    amount, 
                    date: data.owing[data.owing.length - 1].date 
                });
                document.getElementById('owingName').value = '';
                document.getElementById('owingAmount').value = '';
                document.getElementById('owingType').value = '';
                saveData();
                updateDisplay();
            } else {
                alert('Please fill all fields correctly.');
            }
        });

        // Add Upcoming
        document.getElementById('addUpcomingBtn').addEventListener('click', () => {
            const desc = document.getElementById('upcomingDesc').value.trim();
            const amount = parseFloat(document.getElementById('upcomingAmount').value);
            const date = document.getElementById('upcomingDate').value || currentDate.toISOString().split('T')[0];
            if (desc && amount > 0) {
                const newId = Date.now();
                data.upcoming.push({ id: newId, desc, amount, date });
                data.history.push({ id: newId, type: 'expense', desc, amount, date });
                document.getElementById('upcomingDesc').value = '';
                document.getElementById('upcomingAmount').value = '';
                document.getElementById('upcomingDate').value = '';
                saveData();
                updateDisplay();
            } else {
                alert('Please enter a valid description and amount.');
            }
        });

        // Add Goal
        document.getElementById('addGoalBtn').addEventListener('click', () => {
            const desc = document.getElementById('goalDesc').value.trim();
            const target = parseFloat(document.getElementById('goalTarget').value);
            const current = parseFloat(document.getElementById('goalCurrent').value) || 0;
            if (desc && target > 0) {
                const newId = Date.now();
                data.goals.push({ id: newId, desc, target, current });
                document.getElementById('goalDesc').value = '';
                document.getElementById('goalTarget').value = '';
                document.getElementById('goalCurrent').value = '';
                saveData();
                updateDisplay();
            } else {
                alert('Please enter a valid description and target amount.');
            }
        });

        // History View
        document.getElementById('viewHistoryBtn').addEventListener('click', () => {
            const date = document.getElementById('historyDateInput').value;
            const historyList = document.getElementById('historyList');
            let filteredHistory = data.history;
            if (date) {
                filteredHistory = data.history.filter(h => h.date === date);
            }
            historyList.innerHTML = '<ul>' + filteredHistory.map(h => 
                `<li>${h.desc} - ${formatCurrency(h.amount)} <small>${new Date(h.date).toLocaleDateString()}</small> <span class="category-tag ${h.type}">${h.type === 'income' ? '+' : '-'}</span></li>`
            ).join('') + '</ul>';
        });

        // Export History
        document.getElementById('exportHistoryBtn').addEventListener('click', () => {
            const history = data.history.map(h => `${h.date}: ${h.desc} ${formatCurrency(h.amount)}`).join('\n');
            const blob = new Blob([history], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `finflow-history-${currentMonth}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        });

        // Delete All Data
        document.getElementById('deleteAllBtn').addEventListener('click', () => {
            if (confirm('Are you sure? This will delete all your data and reset to sample!')) {
                localStorage.removeItem(STORAGE_KEY);
                data = { user: { name: '', bank: '', currency: 'CAD', balance: 0, savings: 0 }, income: [], expenses: [], owing: [], upcoming: [], goals: [], history: [] };
                updateDisplay();
                alert('All data cleared.');
            }
        });

        // Dashboard Card Modals
        document.querySelectorAll('.dashboard-card').forEach(card => {
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                const modalType = card.dataset.modal;
                const modalTitle = document.getElementById('modalTitle');
                const modalBody = document.getElementById('modalBody');
                let content = '';
                switch (modalType) {
                    case 'bank':
                        content = `<p><strong>Bank:</strong> ${data.user.bank || 'Not set'}</p><p><strong>Currency:</strong> ${data.user.currency || 'CAD'} (${currencySymbols[data.user.currency] || ''})</p>`;
                        break;
                    case 'balance':
                        content = `<p><strong>Current Balance:</strong> ${formatCurrency(data.user.balance)}</p><p><strong>Savings:</strong> ${formatCurrency(data.user.savings)}</p>`;
                        break;
                    case 'owetome':
                        content = data.owing.filter(o => o.type === 'they-owe-me').map(o => `<li><strong>${o.name}:</strong> ${formatCurrency(o.amount)}</li>`).join('') || '<p>No outstanding amounts owed to you.</p>';
                        content = `<ul style="list-style-type: none;">${content}</ul>`;
                        break;
                    case 'owebyme':
                        content = data.owing.filter(o => o.type === 'i-owe').map(o => `<li><strong>${o.name}:</strong> ${formatCurrency(o.amount)}</li>`).join('') || '<p>You owe nothing to others.</p>';
                        content = `<ul style="list-style-type: none;">${content}</ul>`;
                        break;
                    case 'upcoming':
                        content = data.upcoming.map(u => `<li><strong>${u.desc}:</strong> ${formatCurrency(u.amount)} <small>(Due: ${new Date(u.date).toLocaleDateString()})</small></li>`).join('') || '<p>No upcoming payments.</p>';
                        content = `<ul style="list-style-type: none;">${content}</ul>`;
                        break;
                    case 'net':
                        const totalIncome = data.income.reduce((sum, i) => sum + i.amount, 0);
                        const totalExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);
                        const owedToMe = data.owing.filter(o => o.type === 'they-owe-me').reduce((sum, o) => sum + o.amount, 0);
                        const iOwe = data.owing.filter(o => o.type === 'i-owe').reduce((sum, o) => sum + o.amount, 0);
                        const upcomingTotal = data.upcoming.reduce((sum, u) => sum + u.amount, 0);
                        content = `<p><strong>Net Worth Breakdown:</strong></p><ul style="list-style-type: none;"><li>Balance: ${formatCurrency(data.user.balance)}</li><li>Savings: ${formatCurrency(data.user.savings)}</li><li>Total Income: ${formatCurrency(totalIncome)}</li><li>Total Expenses: ${formatCurrency(totalExpenses)}</li><li>Owed To Me: ${formatCurrency(owedToMe)}</li><li>I Owe: ${formatCurrency(iOwe)}</li><li>Upcoming: ${formatCurrency(upcomingTotal)}</li></ul>`;
                        break;
                }
                modalTitle.textContent = card.querySelector('h3').textContent;
                modalBody.innerHTML = content;
                document.getElementById('modalOverlay').classList.add('show');
            });
        });

        // Close Modal
        document.getElementById('closeModal').addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('modalOverlay').classList.remove('show');
        });

        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'modalOverlay') {
                document.getElementById('modalOverlay').classList.remove('show');
            }
        });

        // Chatbot Functionality
        const chatbotButton = document.getElementById('chatbotButton');
        const chatbotWindow = document.getElementById('chatbotWindow');
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendBtn');
        const messages = document.getElementById('chatbotMessages');
        const closeChatbot = document.getElementById('closeChatbot');

        chatbotButton.addEventListener('click', (e) => {
            e.stopPropagation();
            chatbotWindow.classList.toggle('show');
        });

        closeChatbot.addEventListener('click', (e) => {
            e.stopPropagation();
            chatbotWindow.classList.remove('show');
        });

        function addMessage(text, isUser = false) {
            const message = document.createElement('div');
            message.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
            message.textContent = text;
            messages.appendChild(message);
            messages.scrollTop = messages.scrollHeight;
        }

        sendBtn.addEventListener('click', () => {
            const text = chatInput.value.trim();
            if (text) {
                addMessage(text, true);
                chatInput.value = '';
                setTimeout(() => {
                    let response = 'Got it! ';
                    const lowerText = text.toLowerCase();
                    if (lowerText.includes('income')) response += `Your total income is ${document.getElementById('displayTotalIncome').textContent}. Monthly: ${formatCurrency(getMonthlyIncome())}. Keep earning!`;
                    else if (lowerText.includes('expense') || lowerText.includes('expenses')) response += `Current expenses total: ${document.getElementById('displayTotalExpenses').textContent}. Monthly: ${formatCurrency(getMonthlyExpenses())}. Categorize to save more.`;
                    else if (lowerText.includes('tip') || lowerText.includes('advice') || lowerText.includes('budget')) response += 'Pro Tip: Use zero-based budgeting - assign every dollar a job. Track needs (50%), wants (30%), savings (20%).';
                    else if (lowerText.includes('goal') || lowerText.includes('goals')) response += `You have ${data.goals.length} goals set. Add one in the Goals section to track progress toward financial dreams like saving for a house or vacation.`;
                    else if (lowerText.includes('report') || lowerText.includes('summary')) response += `September Summary: Income ${formatCurrency(getMonthlyIncome())}, Expenses ${formatCurrency(getMonthlyExpenses())}, Net ${formatCurrency(getMonthlyNet())}. Check the Reports section for details.`;
                    else if (lowerText.includes('net') || lowerText.includes('worth')) response += `Your net worth is ${document.getElementById('displayNet').textContent}. Track investments and savings to grow it.`;
                    else if (lowerText.includes('currency')) response += `You're using ${data.user.currency} (${currencySymbols[data.user.currency]}). Change in Account Setup if needed.`;
                    else if (lowerText.includes('bank')) response += `Your bank is set to ${data.user.bank}. Supports Canadian, Nigerian, and more.`;
                    else if (lowerText.includes('save') || lowerText.includes('savings')) response += `Your savings: ${document.getElementById('displaySavings').textContent}. Aim for 3-6 months of expenses in an emergency fund.`;
                    else if (lowerText.includes('zero-based')) response += 'Zero-based budgeting means your income minus expenses equals zero. Every dollar is planned - great for control!';
                    else response += "I can help with income, expenses, goals, reports, tips, or summaries. What else about your budget?";
                    addMessage(response);
                }, 800);
            }
        });

        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendBtn.click();
        });

        // Enter key handlers for add buttons
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const active = document.activeElement;
                if (active.id.includes('Amount')) {
                    const type = active.id.replace('Amount', '').toLowerCase();
                    const btn = document.getElementById(`add${type.charAt(0).toUpperCase() + type.slice(1)}Btn`);
                    if (btn) btn.click();
                }
            }
        });

        // Initial load after password
        document.addEventListener('DOMContentLoaded', () => {
            if (!localStorage.getItem(STORAGE_KEY)) {
                data.user.balance = 5250.75;
                data.user.savings = 12400;
                data.user.currency = 'CAD';
                data.user.bank = 'CIBC';
                data.income = [
                    { id: 1, desc: 'Salary', amount: 5000, date: '2025-09-01' },
                    { id: 2, desc: 'Freelance Work', amount: 500, date: '2025-09-05' }
                ];
                data.expenses = [
                    { id: 3, desc: 'Rent', category: 'Housing', amount: 1500, date: '2025-09-02' },
                    { id: 4, desc: 'Groceries', category: 'Food', amount: 450.25, date: '2025-09-07' }
                ];
                data.owing = [
                    { id: 5, name: 'John', amount: 150, type: 'they-owe-me', date: '2025-09-03' },
                    { id: 6, name: 'Sarah', amount: 200, type: 'i-owe', date: '2025-09-04' }
                ];
                data.upcoming = [
                    { id: 7, desc: 'Car Payment', amount: 300, date: '2025-09-15' },
                    { id: 8, desc: 'Internet Bill', amount: 85, date: '2025-09-20' }
                ];
                data.goals = [
                    { id: 9, desc: 'Emergency Fund', target: 10000, current: 12400 },
                    { id: 10, desc: 'Vacation', target: 5000, current: 1000 }
                ];
                data.history = [
                    ...data.income.map(i => ({ ...i, type: 'income' })),
                    ...data.expenses.map(e => ({ ...e, type: 'expense' })),
                    ...data.owing.map(o => ({ 
                        ...o, 
                        type: o.type === 'they-owe-me' ? 'income' : 'expense', 
                        desc: `${o.type === 'they-owe-me' ? 'Owed by' : 'Owe to'} ${o.name}` 
                    })),
                    ...data.upcoming.map(u => ({ ...u, type: 'expense', desc: u.desc }))
                ];
                saveData();
                updateDisplay();
            }
        });

        // Ensure functionality on load
        loadData();
    