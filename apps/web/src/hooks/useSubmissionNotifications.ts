import { useState, useEffect, useCallback, useRef } from 'react';

interface Submission {
  submitted_at: string | number;
  blob_id: string;
  respondent: string;
  [key: string]: unknown;
}

export function useSubmissionNotifications(formId: string, userAddress: string, enabled: boolean) {
  const [newSubmission, setNewSubmission] = useState<Submission | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const lastCheckedRef = useRef<number>(Date.now());
  const initialLoadRef = useRef<boolean>(true);

  const fetchSubmissions = useCallback(async () => {
    if (!formId || !userAddress || !enabled) return;

    try {
      // Use the correct API URL - assuming localhost:4000 for development
      const res = await fetch(`http://localhost:4000/forms/${formId}/submissions?caller_address=${userAddress}`);
      if (!res.ok) throw new Error("Failed to fetch submissions");
      
      const data = await res.json();
      const submissions: Submission[] = data.submissions || [];
      
      if (submissions.length > 0) {
        // Sort by submitted_at desc to get the latest
        const sorted = [...submissions].sort((a, b) => 
          new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
        );
        const latest = sorted[0];
        const latestTime = new Date(latest.submitted_at).getTime();

        if (initialLoadRef.current) {
          lastCheckedRef.current = latestTime;
          initialLoadRef.current = false;
          return;
        }

        if (latestTime > lastCheckedRef.current) {
          setNewSubmission(latest);
          setNotificationCount(prev => prev + 1);
          lastCheckedRef.current = latestTime;
        }
      }
    } catch (e) {
      console.error("Failed to poll notifications:", e);
    }
  }, [formId, userAddress, enabled]);

  useEffect(() => {
    if (!enabled || !formId || !userAddress) {
      setNewSubmission(null);
      setNotificationCount(0);
      return;
    }

    // Initial check
    fetchSubmissions();

    // Poll every 10 seconds
    const interval = setInterval(fetchSubmissions, 10000);
    return () => clearInterval(interval);
  }, [enabled, formId, userAddress, fetchSubmissions]);

  const clearNotifications = useCallback(() => {
    setNewSubmission(null);
    setNotificationCount(0);
  }, []);

  return {
    newSubmission,
    notificationCount,
    clearNotifications,
  };
}
