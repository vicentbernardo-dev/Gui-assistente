import { CalendarEvent, CardColorTheme, EmailMessage } from '../types';
import { getWorkspaceAccessToken } from './firebaseAuth';

const EVENT_COLORS: CardColorTheme[] = ['indigo', 'yellow', 'lime', 'lavender', 'coral'];

export async function fetchGoogleCalendarEvents(dateMinIso: string, dateMaxIso: string): Promise<CalendarEvent[]> {
  const token = getWorkspaceAccessToken();
  if (!token) {
    throw new Error('Faça login com o Google para sincronizar sua agenda.');
  }

  const params = new URLSearchParams({
    timeMin: dateMinIso,
    timeMax: dateMaxIso,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '40',
  });

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro ao ler Google Calendar (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];

  return items.map((item: any, idx: number): CalendarEvent => {
    const startRaw: string = item.start?.dateTime || item.start?.date || new Date().toISOString();
    const endRaw: string = item.end?.dateTime || item.end?.date || startRaw;
    const startDt = new Date(startRaw);
    const endDt = new Date(endRaw);

    const dateStr = startRaw.includes('T')
      ? `${startDt.getFullYear()}-${String(startDt.getMonth() + 1).padStart(2, '0')}-${String(startDt.getDate()).padStart(2, '0')}`
      : startRaw.slice(0, 10);

    const startTime = startRaw.includes('T')
      ? `${String(startDt.getHours()).padStart(2, '0')}:${String(startDt.getMinutes()).padStart(2, '0')}`
      : '09:00';

    const endTime = endRaw.includes('T')
      ? `${String(endDt.getHours()).padStart(2, '0')}:${String(endDt.getMinutes()).padStart(2, '0')}`
      : '10:00';

    return {
      id: `gcal-${item.id}`,
      googleEventId: item.id,
      title: item.summary || 'Evento sem título',
      description: item.description || '',
      date: dateStr,
      startTime,
      endTime,
      location: item.location || (item.hangoutLink ? 'Google Meet' : ''),
      meetLink: item.hangoutLink || '',
      color: EVENT_COLORS[idx % EVENT_COLORS.length],
      source: 'google',
    };
  });
}

export async function createGoogleCalendarEvent(payload: {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  description?: string;
  location?: string;
}): Promise<CalendarEvent> {
  const token = getWorkspaceAccessToken();
  if (!token) {
    throw new Error('Conecte sua conta Google para criar eventos no Google Calendar.');
  }

  const startIso = new Date(`${payload.date}T${payload.startTime}:00`).toISOString();
  const endIso = new Date(`${payload.date}T${payload.endTime}:00`).toISOString();

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: payload.title,
      description: payload.description || '',
      location: payload.location || '',
      start: { dateTime: startIso },
      end: { dateTime: endIso },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro ao criar evento no Google Calendar (${res.status}): ${errText}`);
  }

  const created = await res.json();
  return {
    id: `gcal-${created.id}`,
    googleEventId: created.id,
    title: payload.title,
    description: payload.description || '',
    date: payload.date,
    startTime: payload.startTime,
    endTime: payload.endTime,
    location: payload.location || '',
    color: 'indigo',
    source: 'google',
  };
}

export async function deleteGoogleCalendarEvent(googleEventId: string): Promise<void> {
  const token = getWorkspaceAccessToken();
  if (!token) {
    throw new Error('Conecte sua conta Google para excluir eventos do Google Calendar.');
  }

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(googleEventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const errText = await res.text();
    throw new Error(`Erro ao excluir evento do Google Calendar (${res.status}): ${errText}`);
  }
}

export async function fetchGmailMessages(maxResults = 10): Promise<EmailMessage[]> {
  const token = getWorkspaceAccessToken();
  if (!token) {
    throw new Error('Conecte sua conta Google para sincronizar seus e-mails.');
  }

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=in:inbox`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(`Erro ao listar Gmail (${listRes.status}): ${errText}`);
  }

  const listData = await listRes.json();
  const messageRefs: Array<{ id: string }> = Array.isArray(listData.messages) ? listData.messages : [];

  const detailed = await Promise.all(
    messageRefs.slice(0, maxResults).map(async (ref) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${ref.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!msgRes.ok) return null;
      const msgData = await msgRes.json();
      const headers: Array<{ name: string; value: string }> = msgData.payload?.headers || [];
      const from = headers.find((h) => h.name.toLowerCase() === 'from')?.value || 'Remetente desconhecido';
      const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value || '(Sem assunto)';
      const dateRaw = headers.find((h) => h.name.toLowerCase() === 'date')?.value;
      const receivedAt = dateRaw
        ? new Date(dateRaw).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : 'Hoje';

      const emailObj: EmailMessage = {
        id: `gmail-${msgData.id}`,
        from,
        subject,
        snippet: String(msgData.snippet || ''),
        receivedAt,
        urgency: 'info',
        aiReason: '',
        suggestedAction: '',
        isRead: !(msgData.labelIds || []).includes('UNREAD'),
        source: 'gmail',
      };
      return emailObj;
    })
  );

  return detailed.filter((m): m is EmailMessage => m !== null);
}
