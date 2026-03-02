import React, { useEffect, useState } from 'react';
import '../styles/ManagePods.css';
import { getUserPods, unregisterPod, updatePod, registerPod } from '../utils/api';

interface Pod {
  id: string;
  nickname: string;
  visibility: 'public' | 'private';
  latitude?: number;
  longitude?: number;
}

const ManagePods: React.FC = () => {
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState<null | Pod>(null);
  const [form, setForm] = useState<Partial<Pod>>({});


  useEffect(() => {
    fetchPods();
  }, []);

  const fetchPods = async () => {
    setLoading(true);
    setError(null);
    try {
      const userPods = await getUserPods();
      setPods(userPods.pods);
    } catch (e: any) {
      setError(e.message || 'Failed to load pods');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (podId: string) => {
    if (!window.confirm('Are you sure you want to delete this pod?')) return;
    try {
      await unregisterPod({ podId });
      fetchPods();
    } catch (e: any) {
      setError(e.message || 'Failed to delete pod');
    }
  };

  const handleEdit = (pod: Pod) => {
    setShowEdit(pod);
    setForm(pod);
  };

  const handleAdd = () => {
    setShowAdd(true);
    setForm({});
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (showEdit) {
        await updatePod({
          podId: form.id!,
          nickname: form.nickname,
          visibility: form.visibility,
          latitude: form.latitude,
          longitude: form.longitude,
        });
      } else {
        await registerPod({
          podId: form.id!,
          nickname: form.nickname!,
          visibility: form.visibility!,
          latitude: form.latitude,
          longitude: form.longitude,
        });
      }
      setShowAdd(false);
      setShowEdit(null);
      fetchPods();
    } catch (e: any) {
      setError(e.message || 'Failed to save pod');
    }
  };

  return (
    <div className="manage-pods-container">
      <h2>Manage My Pods</h2>
      {error && <div className="error">{error}</div>}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          <button onClick={handleAdd}>Add Pod</button>
          <table className="pods-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nickname</th>
                <th>Visibility</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pods.map((pod) => (
                <tr key={pod.id}>
                  <td>{pod.id}</td>
                  <td>{pod.nickname}</td>
                  <td>{pod.visibility}</td>
                  <td>{pod.latitude ?? '-'}</td>
                  <td>{pod.longitude ?? '-'}</td>
                  <td>
                    <button onClick={() => handleEdit(pod)}>Update</button>
                    <button onClick={() => handleDelete(pod.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {(showAdd || showEdit) && (
        <div className="modal">
          <form onSubmit={handleFormSubmit} className="pod-form">
            <h3>{showEdit ? 'Update Pod' : 'Add Pod'}</h3>
            <label>
              Pod ID:
              <input
                name="id"
                value={form.id || ''}
                onChange={handleFormChange}
                disabled={!!showEdit}
                required
              />
            </label>
            <label>
              Nickname:
              <input
                name="nickname"
                value={form.nickname || ''}
                onChange={handleFormChange}
                required
              />
            </label>
            <label>
              Visibility:
              <select name="visibility" value={form.visibility || 'private'} onChange={handleFormChange} required>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </label>
            <label>
              Latitude:
              <input
                name="latitude"
                type="number"
                step="0.0001"
                value={form.latitude ?? ''}
                onChange={handleFormChange}
              />
            </label>
            <label>
              Longitude:
              <input
                name="longitude"
                type="number"
                step="0.0001"
                value={form.longitude ?? ''}
                onChange={handleFormChange}
              />
            </label>
            <div className="form-actions">
              <button type="submit">{showEdit ? 'Update' : 'Add'}</button>
              <button type="button" onClick={() => { setShowAdd(false); setShowEdit(null); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ManagePods;
