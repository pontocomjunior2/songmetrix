// This is the correct removeUser function. Copy this version into AuthContext.tsx:

const removeUser = async (userId: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const isAdmin = user.user_metadata?.status === 'ADMIN';
    if (!isAdmin) {
      throw new Error('Usuário não tem permissão de administrador');
    }

    // Call the stored procedure to delete the user
    const { error } = await supabase.rpc('delete_user_admin', {
      user_id: userId
    });

    if (error) {
      console.error('Error deleting user:', error);
      throw new Error('Erro ao remover usuário');
    }

    // Refresh the users list to update the UI
    await supabase
      .from('users')
      .select()
      .limit(1)
      .single();

  } catch (error) {
    console.error('Error in removeUser:', error);
    throw error;
  }
};

/*
Instructions:
1. In AuthContext.tsx, find and remove both existing removeUser functions
2. Then paste this version of the removeUser function in their place
3. Make sure there is only ONE removeUser function in the file
*/
