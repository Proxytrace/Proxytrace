import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useCurrentProject from '../../hooks/useCurrentProject';
import { EvaluatorKind, type EvaluatorDetailDto } from '../../api/models';
import { Modal, ModalFooter } from '../../components/overlays/Modal';
import { type RangeKey } from '../../lib/time-range';
import { META, initForm, type EvaluatorFormState } from './evaluatorMeta';
import { EvaluatorForm } from './EvaluatorForm';
import { EvalRail } from './components/EvalRail';
import { EvaluatorDetail } from './components/EvaluatorDetail';
import { EmptyDetail } from './components/EmptyDetail';
import { NewEvaluatorModal } from './components/NewEvaluatorModal';
import {
  useEvaluatorsOverview,
  useAgenticPresets,
} from './hooks/useEvaluatorQueries';
import {
  useCreateEvaluator,
  useUpdateEvaluator,
  useDeleteEvaluator,
  formFromEvaluator,
} from './hooks/useEvaluatorMutations';

export default function Evaluators() {
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id: string }>();
  const { currentProjectId } = useCurrentProject();

  const [range, setRange] = useState<RangeKey>('7d');
  const [showNew, setShowNew] = useState(false);
  const [pickedKind, setPickedKind] = useState<EvaluatorKind | null>(null);
  const [createForm, setCreateForm] = useState<EvaluatorFormState>(initForm());
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EvaluatorFormState>(initForm());
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { evaluators, suites, sparklines, isLoading } = useEvaluatorsOverview(currentProjectId);
  const { data: presets = [] } = useAgenticPresets();
  const { sparklineById, avgScoreById } = sparklines;

  const selected = routeId ? evaluators.find(e => e.id === routeId) ?? null : null;
  const editTarget = evaluators.find(e => e.id === editTargetId) ?? null;
  const deleteTarget = evaluators.find(e => e.id === deleteTargetId) ?? null;

  useEffect(() => {
    if (!routeId && evaluators.length > 0) {
      navigate(`/evaluators/${evaluators[0].id}`, { replace: true });
    }
  }, [routeId, evaluators, navigate]);

  const attachedSuites = selected
    ? suites
        .filter(s => s.evaluatorIds.includes(selected.id))
        .map(s => ({ id: s.id, name: s.name, agentName: s.agentName }))
    : [];

  const createEval = useCreateEvaluator(currentProjectId);
  const updateEval = useUpdateEvaluator(currentProjectId);
  const deleteEval = useDeleteEvaluator(currentProjectId);

  function submitCreate() {
    if (!pickedKind || !currentProjectId) return;
    createEval.mutate(
      { kind: pickedKind, projectId: currentProjectId, form: createForm },
      {
        onSuccess: e => {
          navigate(`/evaluators/${e.id}`);
          setShowNew(false);
          setPickedKind(null);
          setCreateForm(initForm());
        },
      },
    );
  }

  function submitUpdate() {
    if (!editTarget) return;
    updateEval.mutate(
      { id: editTarget.id, kind: editTarget.kind, form: editForm },
      { onSuccess: () => setEditTargetId(null) },
    );
  }

  function submitDelete() {
    if (!deleteTargetId) return;
    const targetId = deleteTargetId;
    deleteEval.mutate(targetId, {
      onSuccess: () => {
        if (routeId === targetId) navigate('/evaluators');
        setDeleteTargetId(null);
      },
    });
  }

  function openEdit(e: EvaluatorDetailDto) {
    setEditTargetId(e.id);
    setEditForm(formFromEvaluator(e));
  }

  function openNew() {
    setShowNew(true);
    setPickedKind(null);
    setCreateForm(initForm());
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 grid grid-cols-[288px_1fr] gap-3.5 min-h-0">
        <EvalRail
          evaluators={evaluators}
          isLoading={isLoading}
          selectedId={routeId ?? null}
          onSelect={id => navigate(`/evaluators/${id}`)}
          onNew={openNew}
          sparklineById={sparklineById}
          avgScoreById={avgScoreById}
        />

        <main className="min-w-0 overflow-y-auto flex flex-col">
          {selected ? (
            <EvaluatorDetail
              evaluator={selected}
              attachedSuites={attachedSuites}
              range={range}
              onRangeChange={setRange}
              onEdit={() => openEdit(selected)}
              onDelete={() => setDeleteTargetId(selected.id)}
              onTestBench={id => navigate(`/evaluator-playground?id=${id}`)}
            />
          ) : (
            <EmptyDetail hasAny={evaluators.length > 0} onCreate={openNew} />
          )}
        </main>
      </div>

      {showNew && (
        <NewEvaluatorModal
          pickedKind={pickedKind}
          setPickedKind={setPickedKind}
          form={createForm}
          setForm={setCreateForm}
          presets={presets}
          onClose={() => setShowNew(false)}
          onSubmit={submitCreate}
          loading={createEval.isPending}
        />
      )}

      {editTarget && (
        <Modal
          title={`Edit ${META[editTarget.kind]?.label ?? 'Evaluator'}`}
          onClose={() => setEditTargetId(null)}
          maxWidth={520}
          footer={
            <ModalFooter
              onCancel={() => setEditTargetId(null)}
              onSubmit={submitUpdate}
              submitLabel={updateEval.isPending ? 'Saving…' : 'Save'}
              loading={updateEval.isPending}
            />
          }
        >
          <EvaluatorForm form={editForm} setForm={setEditForm} kind={editTarget.kind} presets={presets} showPresetPicker={false} />
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title={`Delete "${deleteTarget.name}"`}
          onClose={() => setDeleteTargetId(null)}
          footer={
            <ModalFooter
              onCancel={() => setDeleteTargetId(null)}
              onSubmit={submitDelete}
              submitLabel={deleteEval.isPending ? 'Deleting…' : 'Delete'}
              loading={deleteEval.isPending}
              danger
            />
          }
        >
          <p className="text-[13px] text-secondary m-0">
            This will permanently remove <strong>{deleteTarget.name}</strong> and detach it from all test suites.
          </p>
        </Modal>
      )}
    </div>
  );
}
