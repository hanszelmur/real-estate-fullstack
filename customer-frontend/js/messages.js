/**
 * Customer Messages JavaScript
 * 
 * Handles messaging functionality for customers including:
 * - Viewing inbox and sent messages
 * - Composing new messages
 * - Replying to messages
 * - Marking messages as read
 */

let currentTab = 'inbox';
let currentPage = 1;
let totalPages = 1;
let unreadCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in
    if (!isAuthenticated()) {
        window.location.href = 'index.html';
        return;
    }
    
    loadMessages();
    loadRecipients();
    
    // Check for pre-fill recipient from URL params (e.g., from appointment page)
    const urlParams = new URLSearchParams(window.location.search);
    const recipientId = urlParams.get('to');
    const subject = urlParams.get('subject');
    
    if (recipientId) {
        setTimeout(() => {
            showComposeModal();
            document.getElementById('recipientSelect').value = recipientId;
            if (subject) {
                document.getElementById('messageSubject').value = decodeURIComponent(subject);
            }
        }, 500);
    }
});

/**
 * Load messages based on current tab
 */
async function loadMessages() {
    const container = document.getElementById('messagesList');
    container.innerHTML = '<div class="loading">Loading messages...</div>';
    
    const endpoint = currentTab === 'inbox' 
        ? `/messages/inbox?page=${currentPage}` 
        : `/messages/sent?page=${currentPage}`;
    
    const response = await API.get(endpoint);
    
    if (response.ok && response.data.success) {
        const messages = response.data.messages;
        const pagination = response.data.pagination;
        
        totalPages = pagination.totalPages || 1;
        
        // Update unread count for inbox
        if (currentTab === 'inbox' && response.data.unreadCount !== undefined) {
            unreadCount = response.data.unreadCount;
            updateUnreadBadges();
        }
        
        if (messages.length === 0) {
            container.innerHTML = `
                <div class="text-center" style="padding: 40px;">
                    <p>${currentTab === 'inbox' ? 'No messages in your inbox.' : 'No sent messages.'}</p>
                    ${currentTab === 'inbox' ? '<p style="margin-top: 10px;">Your messages from agents will appear here.</p>' : ''}
                </div>
            `;
            updatePagination(false);
            return;
        }
        
        container.innerHTML = messages.map(msg => createMessageCard(msg)).join('');
        updatePagination(true);
    } else {
        container.innerHTML = '<p class="text-center">Failed to load messages. Please try again.</p>';
        updatePagination(false);
    }
}

/**
 * Create message card HTML
 */
function createMessageCard(message) {
    const isInbox = currentTab === 'inbox';
    const otherParty = isInbox 
        ? `${message.sender_first_name} ${message.sender_last_name}` 
        : `${message.recipient_first_name} ${message.recipient_last_name}`;
    const role = isInbox ? message.sender_role : message.recipient_role;
    const roleLabel = role ? `(${capitalizeFirst(role)})` : '';
    const isUnread = isInbox && !message.is_read;
    
    const date = new Date(message.created_at);
    const formattedDate = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
    const formattedTime = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
    });
    
    return `
        <div class="message-card ${isUnread ? 'unread' : ''}" onclick="viewMessage(${message.id})">
            <div class="message-header">
                <span class="message-from">
                    ${isUnread ? '● ' : ''}
                    <strong>${isInbox ? 'From:' : 'To:'}</strong> ${escapeHtml(otherParty)} ${roleLabel}
                </span>
                <span class="message-date">${formattedDate} at ${formattedTime}</span>
            </div>
            <div class="message-subject">${escapeHtml(message.subject)}</div>
            <div class="message-preview">${escapeHtml(truncateText(message.body, 100))}</div>
            ${message.parent_id ? '<span class="message-reply-indicator">↩️ Reply</span>' : ''}
        </div>
    `;
}

/**
 * View a single message
 */
async function viewMessage(messageId) {
    const container = document.getElementById('viewMessageContent');
    container.innerHTML = '<div class="loading">Loading message...</div>';
    openModal('viewModal');
    
    const response = await API.get(`/messages/${messageId}`);
    
    if (response.ok && response.data.success) {
        const msg = response.data.message;
        const parent = response.data.parent;
        const replies = response.data.replies || [];
        
        // Update unread count after viewing
        if (!msg.is_read && msg.recipient_id === getCurrentUser()?.id) {
            unreadCount = Math.max(0, unreadCount - 1);
            updateUnreadBadges();
            loadMessages(); // Refresh list to update read status
        }
        
        const date = new Date(msg.created_at);
        const formattedDate = date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const formattedTime = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit'
        });
        
        let html = `
            <div class="message-detail">
                <h2>${escapeHtml(msg.subject)}</h2>
                <div class="message-meta">
                    <p><strong>From:</strong> ${escapeHtml(msg.sender_first_name)} ${escapeHtml(msg.sender_last_name)} (${capitalizeFirst(msg.sender_role)})</p>
                    <p><strong>To:</strong> ${escapeHtml(msg.recipient_first_name)} ${escapeHtml(msg.recipient_last_name)} (${capitalizeFirst(msg.recipient_role)})</p>
                    <p><strong>Date:</strong> ${formattedDate} at ${formattedTime}</p>
                </div>
        `;
        
        // Show parent message if this is a reply
        if (parent) {
            html += `
                <div class="message-parent">
                    <h4>Original Message:</h4>
                    <div class="parent-content">
                        <p class="parent-meta">From ${escapeHtml(parent.sender_first_name)} ${escapeHtml(parent.sender_last_name)} - ${new Date(parent.created_at).toLocaleDateString()}</p>
                        <p>${escapeHtml(parent.body)}</p>
                    </div>
                </div>
            `;
        }
        
        html += `
                <div class="message-body">
                    ${escapeHtml(msg.body).replace(/\n/g, '<br>')}
                </div>
        `;
        
        // Show replies
        if (replies.length > 0) {
            html += '<div class="message-replies"><h4>Replies:</h4>';
            for (const reply of replies) {
                const replyDate = new Date(reply.created_at);
                html += `
                    <div class="reply-item">
                        <p class="reply-meta">${escapeHtml(reply.sender_first_name)} ${escapeHtml(reply.sender_last_name)} - ${replyDate.toLocaleDateString()} at ${replyDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                        <p class="reply-body">${escapeHtml(reply.body).replace(/\n/g, '<br>')}</p>
                    </div>
                `;
            }
            html += '</div>';
        }
        
        // Action buttons
        const currentUser = getCurrentUser();
        const canReply = msg.sender_id !== currentUser?.id; // Can reply if not the sender
        
        html += `
                <div class="message-actions">
                    ${canReply ? `<button class="btn btn-primary" onclick="showReplyModal(${msg.id}, '${escapeQuotes(msg.subject)}', '${escapeQuotes(msg.sender_first_name + ' ' + msg.sender_last_name)}')">↩️ Reply</button>` : ''}
                    <button class="btn btn-danger" onclick="deleteMessage(${msg.id})">🗑️ Delete</button>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    } else {
        container.innerHTML = '<p class="text-center">Failed to load message.</p>';
    }
}

/**
 * Show compose modal
 */
function showComposeModal() {
    document.getElementById('composeForm').reset();
    document.getElementById('composeError').classList.add('hidden');
    document.getElementById('composeSuccess').classList.add('hidden');
    openModal('composeModal');
}

/**
 * Load recipients (agents with active appointments)
 */
async function loadRecipients() {
    const select = document.getElementById('recipientSelect');
    
    // Load agents from user's appointments
    const response = await API.get('/appointments');
    
    if (response.ok && response.data.success) {
        const appointments = response.data.appointments;
        const agentMap = new Map();
        
        // Get unique agents from appointments
        for (const apt of appointments) {
            if (apt.agent_id && apt.agent_first_name) {
                agentMap.set(apt.agent_id, {
                    id: apt.agent_id,
                    name: `${apt.agent_first_name} ${apt.agent_last_name}`,
                    property: apt.property_title
                });
            }
        }
        
        if (agentMap.size > 0) {
            select.innerHTML = '<option value="">-- Select recipient --</option>' +
                Array.from(agentMap.values()).map(agent => 
                    `<option value="${agent.id}">${escapeHtml(agent.name)} (Agent)</option>`
                ).join('');
        } else {
            select.innerHTML = '<option value="">No agents available - book an appointment first</option>';
        }
    }
}

/**
 * Send a new message
 */
async function sendMessage(event) {
    event.preventDefault();
    
    const errorDiv = document.getElementById('composeError');
    const successDiv = document.getElementById('composeSuccess');
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    
    const recipientId = document.getElementById('recipientSelect').value;
    const subject = document.getElementById('messageSubject').value.trim();
    const body = document.getElementById('messageBody').value.trim();
    
    if (!recipientId) {
        errorDiv.textContent = 'Please select a recipient.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    const response = await API.post('/messages', {
        recipientId: parseInt(recipientId),
        subject,
        body
    });
    
    if (response.ok && response.data.success) {
        successDiv.textContent = 'Message sent successfully!';
        successDiv.classList.remove('hidden');
        
        setTimeout(() => {
            closeModal('composeModal');
            if (currentTab === 'sent') {
                loadMessages();
            } else {
                switchTab('sent');
            }
        }, 1500);
    } else {
        errorDiv.textContent = response.data.error || 'Failed to send message.';
        errorDiv.classList.remove('hidden');
    }
}

/**
 * Show reply modal
 */
function showReplyModal(messageId, subject, senderName) {
    document.getElementById('replyParentId').value = messageId;
    document.getElementById('replyContext').textContent = `Replying to: ${senderName} - "${subject}"`;
    document.getElementById('replyForm').reset();
    document.getElementById('replyError').classList.add('hidden');
    document.getElementById('replySuccess').classList.add('hidden');
    closeModal('viewModal');
    openModal('replyModal');
}

/**
 * Send reply
 */
async function sendReply(event) {
    event.preventDefault();
    
    const errorDiv = document.getElementById('replyError');
    const successDiv = document.getElementById('replySuccess');
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    
    const parentId = document.getElementById('replyParentId').value;
    const body = document.getElementById('replyBody').value.trim();
    
    const response = await API.post(`/messages/${parentId}/reply`, { body });
    
    if (response.ok && response.data.success) {
        successDiv.textContent = 'Reply sent successfully!';
        successDiv.classList.remove('hidden');
        
        setTimeout(() => {
            closeModal('replyModal');
            loadMessages();
        }, 1500);
    } else {
        errorDiv.textContent = response.data.error || 'Failed to send reply.';
        errorDiv.classList.remove('hidden');
    }
}

/**
 * Delete message
 */
async function deleteMessage(messageId) {
    if (!confirm('Are you sure you want to delete this message?')) {
        return;
    }
    
    const response = await API.delete(`/messages/${messageId}`);
    
    if (response.ok && response.data.success) {
        closeModal('viewModal');
        loadMessages();
        alert('Message deleted successfully.');
    } else {
        alert(response.data.error || 'Failed to delete message.');
    }
}

/**
 * Switch between inbox and sent tabs
 */
function switchTab(tab) {
    currentTab = tab;
    currentPage = 1;
    
    document.querySelectorAll('.messages-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    loadMessages();
}

/**
 * Change page
 */
function changePage(delta) {
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        loadMessages();
    }
}

/**
 * Update pagination UI
 */
function updatePagination(show) {
    const pagination = document.getElementById('pagination');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');
    
    if (show && totalPages > 1) {
        pagination.classList.remove('hidden');
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= totalPages;
    } else {
        pagination.classList.add('hidden');
    }
}

/**
 * Update unread badges
 */
function updateUnreadBadges() {
    const navBadge = document.getElementById('unreadBadge');
    const inboxBadge = document.getElementById('inboxBadge');
    
    if (unreadCount > 0) {
        if (navBadge) {
            navBadge.textContent = unreadCount;
            navBadge.classList.remove('hidden');
        }
        if (inboxBadge) {
            inboxBadge.textContent = unreadCount;
            inboxBadge.classList.remove('hidden');
        }
    } else {
        if (navBadge) navBadge.classList.add('hidden');
        if (inboxBadge) inboxBadge.classList.add('hidden');
    }
}

/**
 * Escape HTML
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Escape quotes for inline JS
 */
function escapeQuotes(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"');
}

/**
 * Truncate text
 */
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}
