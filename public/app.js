const form = document.querySelector('#profile-form');
const fields = document.querySelector('#profile-fields');
const status = document.querySelector('#status');
const save = document.querySelector('#save');
const retry = document.querySelector('#retry');

function showStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
}

async function requestProfile(options) {
  const response = await fetch('/api/profile', { ...options, signal: AbortSignal.timeout(10000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not access your profile.');
  return data;
}

async function loadProfile() {
  retry.hidden = true;
  fields.disabled = true;
  showStatus('Loading your profile…');
  try {
    const profile = await requestProfile();
    for (const key of ['name', 'email', 'interests']) form.elements[key].value = profile[key] || '';
    fields.disabled = false;
    showStatus(profile._id ? 'Profile loaded.' : 'Add your details to create your profile.');
  } catch (error) {
    showStatus(error.message, true);
    retry.hidden = false;
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const profile = Object.fromEntries(new FormData(form));
  fields.disabled = true;
  save.textContent = 'Saving…';
  showStatus('Saving your profile…');
  try {
    const saved = await requestProfile({
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile),
    });
    for (const key of ['name', 'email', 'interests']) form.elements[key].value = saved[key];
    showStatus('Profile saved successfully.');
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    fields.disabled = false;
    save.textContent = 'Save profile';
  }
});

retry.addEventListener('click', loadProfile);
loadProfile();
